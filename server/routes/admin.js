const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { User, Subscription, Payment, Coupon, Review, Movie, History, Rating, Notification } = require("../models");
const { z, objectId, email, password, username } = require("../utils/schemas");
const { PLANS } = require("../utils/constants");
const { toCsv, addMonths } = require("../utils/pure");
const { AppError, asyncHandler, escapeRegex, pageOpts, pagination, safeEqual } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { expireStale, grantDays } = require("../services/billing");
const { deleteUserData } = require("../services/misc");
const { notify } = require("../utils/notify");
const rzp = require("../utils/razorpay");

// ---- first admin: needs the server-side ADMIN_REGISTRATION_KEY (or `npm run create-admin`) ----
router.post("/register", authLimiter,
  (req, res, next) => (env.adminKey && safeEqual(req.get("x-admin-key") || "", env.adminKey) ? next() : next(new AppError("Admin registration is disabled or the key is invalid", 403))),
  validate(z.object({ username, email, password })),
  asyncHandler(async (req, res) => {
    if (await User.exists({ $or: [{ email: req.body.email }, { username: req.body.username }] })) throw new AppError("User already exists", 400);
    const u = await User.create({ ...req.body, role: "admin", emailVerified: true, password: await bcrypt.hash(req.body.password, 12) });
    res.status(201).send({ status: true, msg: "Admin created", user: { _id: u._id, username: u.username, role: u.role } });
  }));

router.use(authenticate, requireAdmin);

// ---- users (also mounted at the old /api/auth/users path) ----
const listUsers = asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 50, 500), f = {};
  if (["user", "admin"].includes(req.query.role)) f.role = req.query.role;
  if (req.query.blocked === "true") f.isBlocked = true;
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), "i"); f.$or = [{ username: rx }, { email: rx }]; }
  const [users, total] = await Promise.all([User.find(f, "username email role isBlocked emailVerified createdAt").sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), User.countDocuments(f)]);
  res.send({ status: true, users, pagination: pagination(p, total) });
});
const deleteUser = asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError("User not found", 404);
  if (String(u._id) === String(req.user._id)) throw new AppError("Cannot delete your own account", 400);
  if (u.role === "admin") throw new AppError("Admins cannot be deleted here", 400);
  await deleteUserData(u._id);
  res.send({ status: true, msg: "User deleted successfully" });
});
router.get("/users", listUsers);
router.delete("/users/:id", deleteUser);
const usersRouter = express.Router(); usersRouter.get("/", listUsers); usersRouter.delete("/:id", deleteUser);

router.post("/users/:id/block", validate(z.object({ blocked: z.boolean(), reason: z.string().trim().max(300).optional() })), asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError("User not found", 404);
  if (u.role === "admin") throw new AppError("Admins cannot be blocked", 400);
  u.isBlocked = req.body.blocked; u.blockedReason = req.body.blocked ? req.body.reason : undefined; await u.save();
  res.send({ status: true, msg: req.body.blocked ? "User blocked" : "User unblocked" });
}));
router.post("/users/:id/grant", validate(z.object({ days: z.number().int().min(1).max(3650) })), asyncHandler(async (req, res) => {
  if (!(await User.exists({ _id: req.params.id }))) throw new AppError("User not found", 404);
  const sub = await grantDays(req.params.id, req.body.days, "admin", "bonus");
  notify(req.params.id, { type: "gift", params: { days: req.body.days }, link: "/subscription" });
  res.send({ status: true, subscription: sub });
}));

// ---- subscriptions / payments ----
router.get("/subscriptions", asyncHandler(async (req, res) => {
  await expireStale();
  const p = pageOpts(req.query, 50, 200), f = {};
  if (["active", "expired", "cancelled"].includes(req.query.status)) f.status = req.query.status;
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), "i"); f.user = { $in: (await User.find({ $or: [{ username: rx }, { email: rx }] }).select("_id").limit(500).lean()).map((u) => u._id) }; }
  const [subscriptions, total] = await Promise.all([Subscription.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("user", "username email").lean(), Subscription.countDocuments(f)]);
  res.send({ status: true, subscriptions, pagination: pagination(p, total) });
}));
router.get("/payments", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 50, 200), f = ["created", "paid", "failed", "refunded"].includes(req.query.status) ? { status: req.query.status } : {};
  const [payments, total] = await Promise.all([Payment.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("userId", "username email").lean(), Payment.countDocuments(f)]);
  res.send({ status: true, payments, pagination: pagination(p, total) });
}));
router.post("/payments/:id/refund", asyncHandler(async (req, res) => {
  const pay = await Payment.findById(req.params.id);
  if (!pay || pay.status !== "paid") throw new AppError("Only paid payments can be refunded", 409);
  if (pay.mode === "razorpay" && pay.razorpayPaymentId) await rzp.refund(pay.razorpayPaymentId, Math.round(pay.amount * 100));
  pay.status = "refunded"; await pay.save();
  const sub = await Subscription.findOne({ paymentIds: pay._id, status: "active" }); // take the purchased time back
  if (sub) { sub.endDate = addMonths(sub.endDate, -(PLANS[pay.plan]?.months || 0)); if (sub.endDate <= new Date()) { sub.status = "cancelled"; sub.endDate = new Date(); } await sub.save(); }
  res.send({ status: true, payment: pay });
}));

// ---- coupons (percent / flat / trial-days "free trial links") ----
const couponSchema = z.object({ code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(["percent", "flat", "trial"]), value: z.number().positive(),
  maxDiscount: z.number().positive().optional(), plans: z.array(z.string()).optional(), maxUses: z.number().int().min(0).optional(), expiresAt: z.coerce.date().optional() })
  .refine((c) => c.type !== "percent" || c.value <= 100, "percent must be ≤ 100").refine((c) => c.type !== "trial" || (Number.isInteger(c.value) && c.value <= 365), "trial value is a whole number of days (≤ 365)");
router.post("/coupons", validate(couponSchema), asyncHandler(async (req, res) => res.status(201).send({ status: true, coupon: await Coupon.create(req.body) })));
router.get("/coupons", asyncHandler(async (req, res) => res.send({ status: true, coupons: await Coupon.find().sort({ createdAt: -1 }).select("-usedBy").limit(200).lean() })));
router.patch("/coupons/:id", validate(z.object({ active: z.boolean().optional(), expiresAt: z.coerce.date().optional(), maxUses: z.number().int().min(0).optional() })), asyncHandler(async (req, res) => {
  const c = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!c) throw new AppError("Coupon not found", 404);
  res.send({ status: true, coupon: c });
}));

// ---- review moderation ----
router.get("/reviews", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 30, 100), s = req.query.status;
  const f = s === "reported" ? { "reports.0": { $exists: true } } : ["pending", "hidden", "visible"].includes(s) ? { status: s } : { $or: [{ status: { $in: ["pending", "hidden"] } }, { "reports.0": { $exists: true } }] };
  const [reviews, total] = await Promise.all([Review.find(f).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).lean(), Review.countDocuments(f)]);
  res.send({ status: true, reviews, pagination: pagination(p, total) });
}));
router.post("/reviews/:reviewId/status", validate(z.object({ status: z.enum(["visible", "hidden"]), clearReports: z.boolean().default(false) })), asyncHandler(async (req, res) => {
  const upd = { status: req.body.status }; if (req.body.clearReports) upd.reports = [];
  const r = await Review.findOneAndUpdate({ reviewId: req.params.reviewId }, { $set: upd }, { new: true });
  if (!r) throw new AppError("Review not found", 404);
  res.send({ status: true, review: r });
}));

// ---- broadcast ----
router.post("/notifications/broadcast", validate(z.object({ title: z.string().trim().min(1).max(100), body: z.string().trim().min(1).max(500) })), asyncHandler(async (req, res) => {
  const ids = await User.find({ isBlocked: false }).select("_id").lean();
  for (let i = 0; i < ids.length; i += 1000) await Notification.insertMany(ids.slice(i, i + 1000).map((u) => ({ userId: u._id, type: "admin_message", title: req.body.title, body: req.body.body })));
  res.send({ status: true, sent: ids.length });
}));

// ---- analytics ----
router.get("/analytics/overview", asyncHandler(async (req, res) => {
  const months = Math.min(36, Math.max(1, parseInt(req.query.months, 10) || 12));
  const from = new Date(); from.setMonth(from.getMonth() - (months - 1), 1); from.setHours(0, 0, 0, 0);
  const now = new Date(), d30 = new Date(Date.now() - 30 * 864e5);
  await expireStale();
  const ym = (f) => ({ y: { $year: f }, m: { $month: f } }), label = (r) => `${r._id.y}-${String(r._id.m).padStart(2, "0")}`;
  const [revenue, newUsers, active, byPlan, churned, popularSaved, popularWatched, topRated, totals] = await Promise.all([
    Payment.aggregate([{ $match: { status: "paid", paidAt: { $gte: from } } }, { $group: { _id: ym("$paidAt"), revenue: { $sum: "$amount" }, payments: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
    User.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: ym("$createdAt"), users: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
    Subscription.countDocuments({ status: "active", endDate: { $gt: now } }),
    Subscription.aggregate([{ $match: { status: "active", endDate: { $gt: now } } }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
    Subscription.countDocuments({ status: { $in: ["expired", "cancelled"] }, endDate: { $gte: d30, $lte: now } }),
    Movie.aggregate([{ $group: { _id: { id: "$id", mediaType: "$mediaType" }, title: { $first: "$title" }, saves: { $sum: 1 } } }, { $sort: { saves: -1 } }, { $limit: 10 }]),
    History.aggregate([{ $group: { _id: { id: "$tmdbId", mediaType: "$mediaType" }, title: { $first: "$title" }, viewers: { $sum: 1 }, completions: { $sum: { $cond: ["$completed", 1, 0] } } } }, { $sort: { viewers: -1 } }, { $limit: 10 }]),
    Rating.aggregate([{ $group: { _id: { id: "$tmdbId", mediaType: "$mediaType" }, title: { $first: "$title" }, avg: { $avg: "$stars" }, votes: { $sum: 1 } } }, { $match: { votes: { $gte: 3 } } }, { $sort: { avg: -1, votes: -1 } }, { $limit: 10 }]),
    Promise.all([User.countDocuments(), Review.countDocuments({ status: { $in: ["pending", "hidden"] } }), Review.countDocuments({ "reports.0": { $exists: true }, status: "visible" })]),
  ]);
  const flat = (a) => a.map((x) => ({ id: x._id.id, mediaType: x._id.mediaType, title: x.title, ...x, _id: undefined }));
  res.send({ status: true, range: { from, months },
    totals: { users: totals[0], activeSubscribers: active, churnRate30d: active + churned ? Math.round((churned / (active + churned)) * 1000) / 10 : 0, churned30d: churned, revenue: revenue.reduce((a, r) => a + r.revenue, 0), reviewsToModerate: totals[1], reportedReviews: totals[2] },
    revenueByMonth: revenue.map((r) => ({ month: label(r), revenue: r.revenue, payments: r.payments })), newUsersByMonth: newUsers.map((r) => ({ month: label(r), users: r.users })),
    subscribersByPlan: Object.fromEntries(byPlan.map((p) => [p._id, p.count])),
    popular: { mostSaved: flat(popularSaved), mostWatched: flat(popularWatched), topRated: flat(topRated).map((t) => ({ ...t, avg: Math.round(t.avg * 10) / 10 })) } });
}));

// ---- CSV export (formula-injection safe) ----
router.get("/export/:type", asyncHandler(async (req, res) => {
  const t = req.params.type, LIMIT = 50000;
  let rows, cols;
  if (t === "users") { rows = await User.find({}, "username email role isBlocked emailVerified createdAt").limit(LIMIT).lean(); cols = ["username", "email", "role", "isBlocked", "emailVerified", "createdAt"]; }
  else if (t === "subscriptions") { rows = (await Subscription.find().populate("user", "username email").limit(LIMIT).lean()).map((s) => ({ username: s.user?.username, email: s.user?.email, plan: s.plan, price: s.price, status: s.status, source: s.source, startDate: s.startDate, endDate: s.endDate })); cols = ["username", "email", "plan", "price", "status", "source", "startDate", "endDate"]; }
  else if (t === "payments") { rows = (await Payment.find().populate("userId", "username email").limit(LIMIT).lean()).map((p) => ({ invoice: p.invoiceNumber, username: p.userId?.username, email: p.userId?.email, plan: p.plan, amount: p.amount, discount: p.discount, coupon: p.couponCode, status: p.status, mode: p.mode, paidAt: p.paidAt })); cols = ["invoice", "username", "email", "plan", "amount", "discount", "coupon", "status", "mode", "paidAt"]; }
  else throw new AppError("Export type must be users, subscriptions or payments", 400);
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${t}-${new Date().toISOString().slice(0, 10)}.csv"` }).send(toCsv(rows, cols));
}));

module.exports = router;
module.exports.usersRouter = usersRouter;
