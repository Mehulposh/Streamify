const router = require("express").Router();
const { Coupon } = require("../models");
const { z } = require("../utils/schemas");
const { PLANS } = require("../utils/constants");
const { priceWithCoupon } = require("../utils/pure");
const { AppError, asyncHandler } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { findCoupon } = require("../services/coupons");
const { grantDays } = require("../services/billing");
const { notify } = require("../utils/notify");
router.use(authenticate);

router.post("/validate", validate(z.object({ code: z.string().trim().min(3).max(30), plan: z.string().max(20) })), asyncHandler(async (req, res) => {
  const plan = PLANS[req.body.plan];
  if (!plan) throw new AppError("Invalid plan", 400);
  const c = await findCoupon(req.body.code, req.user._id, { plan: req.body.plan, types: ["percent", "flat"] });
  res.send({ status: true, pricing: priceWithCoupon(plan.price, c), code: c.code });
}));

// "Free trial link" coupons: type=trial gives N free days, once per user
router.post("/redeem", authLimiter, validate(z.object({ code: z.string().trim().min(3).max(30) })), asyncHandler(async (req, res) => {
  const c = await findCoupon(req.body.code, req.user._id, { types: ["trial"] });
  const claimed = await Coupon.findOneAndUpdate({ _id: c._id, usedBy: { $ne: req.user._id }, $or: [{ maxUses: 0 }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] },
    { $inc: { usedCount: 1 }, $addToSet: { usedBy: req.user._id } }, { new: true }); // atomic: no double redeem
  if (!claimed) throw new AppError("Coupon could not be redeemed", 409);
  const sub = await grantDays(req.user._id, c.value, "coupon", "trial");
  notify(req.user._id, { type: "gift", params: { days: c.value }, link: "/subscription" });
  res.send({ status: true, msg: `${c.value} free days added`, subscription: sub });
}));
module.exports = router;
