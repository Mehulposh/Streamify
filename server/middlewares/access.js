const { getAccess } = require("../services/billing");
const { AppError, asyncHandler } = require("../utils/helpers");
/** Server-side paywall: replaces the old localStorage timer that anyone could reset. */
const requireAccess = asyncHandler(async (req, res, next) => {
  const a = await getAccess(req.user);
  if (!a.hasAccess) throw new AppError("An active subscription or free trial is required", 402, "SUBSCRIPTION_REQUIRED");
  req.access = a;
  next();
});
module.exports = { requireAccess };
