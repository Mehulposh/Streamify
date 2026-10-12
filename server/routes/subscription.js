// Subscription management. /create now starts a real payment instead of handing out free plans.
const router = require("express").Router();
const env = require("../config/env");
const { Subscription } = require("../models");
const { z } = require("../utils/schemas");
const { PLANS } = require("../utils/constants");
const { AppError, asyncHandler, pageOpts, pagination } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { getActive, finalizePayment, expireStale } = require("../services/billing");
const { createOrder } = require("./payments");

router.get("/plans", (req, res) => res.send({ status: true, plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p, perMonth: Math.round(p.price / p.months) })), currency: "INR", paymentMode: env.paymentMode }));
router.use(authenticate);

router.get("/get", asyncHandler(async (req, res) => {
  const subscription = await getActive(req.user._id);
  if (!subscription) return res.send({ status: false, msg: "No active subscription found" });
  res.send({ status: true, subscription });
}));
router.get("/mine", asyncHandler(async (req, res) => { await expireStale(req.user._id); res.send({ status: true, subscriptions: await Subscription.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean() }); }));

// Cancel = stop at the end of the paid period (no surprise loss of access; refunds are an admin decision)
router.post("/cancel", asyncHandler(async (req, res) => {
  const s = await getActive(req.user._id);
  if (!s) throw new AppError("No active subscription", 404);
  s.cancelAtPeriodEnd = true; await s.save();
  res.send({ status: true, msg: `Cancelled. You can keep watching until ${s.endDate.toDateString()}.`, subscription: s });
}));
router.post("/resume", asyncHandler(async (req, res) => {
  const s = await getActive(req.user._id);
  if (!s) throw new AppError("No active subscription", 404);
  s.cancelAtPeriodEnd = false; await s.save();
  res.send({ status: true, subscription: s });
}));

// Legacy URL: body {plan, couponCode?}
router.post("/create", validate(z.object({ plan: z.string().max(20), couponCode: z.string().trim().max(30).optional() })), asyncHandler(async (req, res) => {
  const r = await createOrder(req.user, req.body.plan, req.body.couponCode);
  if (!r.activated && r.order?.mock) { // development convenience only
    const done = await finalizePayment({ razorpayOrderId: r.order.orderId, userId: req.user._id });
    return res.status(201).send({ status: true, subscription: done.sub, payment: done.pay, mock: true });
  }
  res.status(201).send({ status: true, ...r });
}));

// ---- admin (legacy URLs, now actually protected) ----
router.get("/all", requireAdmin, asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 50, 200), f = {};
  if (["active", "expired", "cancelled"].includes(req.query.status)) f.status = req.query.status;
  await expireStale();
  const [subscriptions, total] = await Promise.all([Subscription.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("user", "username email").lean(), Subscription.countDocuments(f)]);
  res.send({ status: true, subscriptions, pagination: pagination(p, total) });
}));
router.delete("/delete/:id", requireAdmin, asyncHandler(async (req, res) => {
  const s = await Subscription.findByIdAndDelete(req.params.id);
  if (!s) throw new AppError("Subscription not found", 404);
  res.send({ status: true, msg: "Subscription deleted successfully" });
}));
module.exports = router;
