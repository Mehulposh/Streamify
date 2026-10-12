const crypto = require("crypto");
const env = require("../config/env");
const { Subscription, Payment, Coupon, User } = require("../models");
const { PLANS } = require("../utils/constants");
const { addDays, addMonths } = require("../utils/pure");
const { notify } = require("../utils/notify");
const { AppError } = require("../utils/helpers");

/** Flip anything past its end date to "expired" (also run hourly by jobs/scheduler.js). */
async function expireStale(userId) {
  const f = { status: "active", endDate: { $lte: new Date() } };
  if (userId) f.user = userId;
  const stale = await Subscription.find(f).select("user");
  if (!stale.length) return 0;
  await Subscription.updateMany({ _id: { $in: stale.map((s) => s._id) } }, { status: "expired" });
  stale.forEach((s) => notify(s.user, { type: "subscription_expired", link: "/subscription", email: true }));
  return stale.length;
}
const getActive = async (userId) => { await expireStale(userId); return Subscription.findOne({ user: userId, status: "active", endDate: { $gt: new Date() } }); };

/** Who may stream? admin -> active plan -> server-side free trial. */
async function getAccess(user) {
  if (user.role === "admin") return { hasAccess: true, reason: "admin" };
  const sub = await getActive(user._id);
  if (sub) return { hasAccess: true, reason: "subscription", subscription: sub };
  if (user.trialStartedAt) {
    const left = Math.floor((user.trialStartedAt.getTime() + env.trialMinutes * 60000 - Date.now()) / 1000);
    if (left > 0) return { hasAccess: true, reason: "trial", trialRemainingSeconds: left };
    return { hasAccess: false, reason: "trial_expired", trialRemainingSeconds: 0 };
  }
  return { hasAccess: false, reason: "no_plan", trialAvailable: env.trialMinutes > 0 };
}

/** Create a subscription or EXTEND the active one (a unique index guarantees one active row per user). */
async function activate({ userId, plan, price = 0, months, days, source = "payment", paymentId }) {
  const extend = (from) => (months ? addMonths(from, months) : addDays(from, days));
  const active = await getActive(userId);
  if (active) {
    active.endDate = extend(active.endDate); active.cancelAtPeriodEnd = false; active.expiryReminderSent = false;
    if (paymentId) active.paymentIds.push(paymentId);
    await active.save();
    return active;
  }
  return Subscription.create({ user: userId, plan, price, source, startDate: new Date(), endDate: extend(new Date()), paymentIds: paymentId ? [paymentId] : [] });
}
const grantDays = async (userId, days, source, plan = "bonus") => activate({ userId, plan, days, source });

const invoiceNo = () => `INV-${new Date().getFullYear()}-${crypto.randomInt(0, 1e8).toString().padStart(8, "0")}`;

/** Atomically flips created -> paid exactly once (safe against double webhook + verify), then activates the plan. */
async function finalizePayment(filter, extra = {}) {
  const pay = await Payment.findOneAndUpdate({ ...filter, status: "created" }, { $set: { status: "paid", paidAt: new Date(), invoiceNumber: invoiceNo(), ...extra } }, { new: true });
  if (!pay) return null;
  return { pay, sub: await applyPaid(pay) };
}
async function applyPaid(pay) {
  const plan = PLANS[pay.plan];
  if (!plan) throw new AppError("Unknown plan on payment", 500);
  const sub = await activate({ userId: pay.userId, plan: pay.plan, price: pay.amount, months: plan.months, source: "payment", paymentId: pay._id });
  if (pay.couponCode) await Coupon.updateOne({ code: pay.couponCode, $or: [{ maxUses: 0 }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] }, { $inc: { usedCount: 1 }, $addToSet: { usedBy: pay.userId } });
  const date = sub.endDate.toDateString();
  notify(pay.userId, { type: "payment_received", params: { amount: pay.amount, invoice: pay.invoiceNumber }, link: "/subscription", email: true });
  notify(pay.userId, { type: "subscription_activated", params: { date }, link: "/subscription" });
  // referral reward: the inviter gets free days when the invited friend makes their first paid purchase
  const buyer = await User.findById(pay.userId).select("referredBy").lean();
  if (buyer?.referredBy && pay.amount > 0 && (await Payment.countDocuments({ userId: pay.userId, status: "paid", amount: { $gt: 0 } })) === 1) {
    await grantDays(buyer.referredBy, env.referralBonusDays, "referral");
    notify(buyer.referredBy, { type: "referral_reward", params: { days: env.referralBonusDays }, link: "/subscription", email: true });
  }
  return sub;
}
module.exports = { expireStale, getActive, getAccess, activate, grantDays, finalizePayment, applyPaid, invoiceNo };
