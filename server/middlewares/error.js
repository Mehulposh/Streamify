const env = require("../config/env");
const { AppError } = require("../utils/helpers");
const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500, msg = err.message;
  if (err.name === "ValidationError") { status = 400; msg = Object.values(err.errors).map((e) => e.message).join("; "); }
  else if (err.name === "CastError") { status = 400; msg = "Invalid id or value"; }
  else if (err.code === 11000) { status = 409; msg = "A record with this value already exists"; }
  else if (err.type === "entity.parse.failed") { status = 400; msg = "Malformed JSON body"; }
  else if (err.type === "entity.too.large") { status = 413; msg = "Request body too large"; }
  if (status >= 500) { console.error(err); if (env.isProd) msg = "Something went wrong"; }
  // `status:false` + `msg` is the shape the existing frontend already understands
  res.status(status).send({ status: false, success: false, msg, message: msg, code: err.code });
};
module.exports = { notFound, errorHandler };
