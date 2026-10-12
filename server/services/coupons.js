const { Coupon } = require("../models");
const { AppError, same } = require("../utils/helpers");
/** Validates a coupon for a user. `types` limits what the caller accepts (purchase: percent/flat, redeem: trial). */
async function findCoupon(code, userId, { plan, types } = {}) {
  const bad = (m) => { throw new AppError(m, 400); };
  const c = await Coupon.findOne({ code: String(code).toUpperCase().trim(), active: true });
  if (!c) bad("Invalid coupon code");
  if (types && !types.includes(c.type)) bad("This code cannot be used here");
  if (c.expiresAt && c.expiresAt < new Date()) bad("Coupon has expired");
  if (c.maxUses && c.usedCount >= c.maxUses) bad("Coupon usage limit reached");
  if (c.usedBy.some((u) => same(u, userId))) bad("You have already used this coupon");
  if (plan && c.plans?.length && !c.plans.includes(plan)) bad("Coupon does not apply to this plan");
  return c;
}
module.exports = { findCoupon };
