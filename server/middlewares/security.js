const rateLimit = require("express-rate-limit");
const limiter = (windowMs, limit, msg) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { status: false, success: false, msg } });
// NoSQL-injection guard: drop keys that start with "$" or contain "."
const clean = (o) => {
  if (Array.isArray(o)) return o.forEach(clean);
  if (o && typeof o === "object") for (const k of Object.keys(o)) { if (k.startsWith("$") || k.includes(".")) delete o[k]; else clean(o[k]); }
};
module.exports = {
  sanitize: (req, res, next) => { clean(req.body); clean(req.query); clean(req.params); next(); },
  globalLimiter: limiter(15 * 60 * 1000, 1000, "Too many requests, please try again later."),
  authLimiter: limiter(15 * 60 * 1000, 20, "Too many attempts, please try again in a few minutes."),
  writeLimiter: limiter(60 * 1000, 40, "You are doing that too quickly."),
  tmdbLimiter: limiter(60 * 1000, 240, "Too many catalogue requests, slow down a little."),
};
