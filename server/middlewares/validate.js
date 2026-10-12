const { AppError } = require("../utils/helpers");
// Validates and strips unknown keys (this is what stops {"role":"admin"} at registration)
const validate = (schema, src = "body") => (req, res, next) => {
  const r = schema.safeParse(req[src] || {});
  if (!r.success) return next(new AppError(r.error.issues.map((i) => `${i.path.join(".") || src}: ${i.message}`).join("; "), 400));
  req[src] = r.data;
  next();
};
module.exports = { validate };
