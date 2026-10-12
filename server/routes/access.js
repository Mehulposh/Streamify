const router = require("express").Router();
const env = require("../config/env");
const { AppError, asyncHandler } = require("../utils/helpers");
const { authenticate } = require("../middlewares/auth");
const { getAccess } = require("../services/billing");
router.use(authenticate);

const view = (a) => ({ status: true, hasAccess: a.hasAccess, reason: a.reason, trialRemainingSeconds: a.trialRemainingSeconds, trialAvailable: a.trialAvailable, trialMinutes: env.trialMinutes,
  subscription: a.subscription && { plan: a.subscription.plan, endDate: a.subscription.endDate, cancelAtPeriodEnd: a.subscription.cancelAtPeriodEnd } });

router.get("/status", asyncHandler(async (req, res) => res.send(view(await getAccess(req.user)))));

// The free trial starts once per account and is timed by the SERVER (clearing localStorage no longer resets it).
router.post("/start-trial", asyncHandler(async (req, res) => {
  const a = await getAccess(req.user);
  if (a.reason === "admin" || a.reason === "subscription") throw new AppError("You already have full access", 400);
  if (req.user.trialStartedAt) throw new AppError("Your free trial was already used", 409, "TRIAL_USED");
  if (env.trialMinutes <= 0) throw new AppError("Free trial is not offered", 400);
  req.user.trialStartedAt = new Date(); await req.user.save();
  res.send(view(await getAccess(req.user)));
}));
module.exports = router;
