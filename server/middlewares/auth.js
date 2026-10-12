const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { User } = require("../models");
const { AppError, asyncHandler } = require("../utils/helpers");

const COOKIE = "stream_token";
// payload keeps the old `userDetails` shape so the current frontend's jwtDecode(...).userDetails keeps working
const signToken = (u) => jwt.sign({ id: String(u._id), userDetails: { username: u.username, _id: String(u._id), role: u.role } }, env.jwtSecret, { algorithm: "HS256", expiresIn: env.jwtExpires });
const cookieOpts = () => ({ httpOnly: true, secure: env.isProd, sameSite: env.cookieSameSite, path: "/" });
const setAuthCookie = (res, token) => res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: 7 * 24 * 3600 * 1000 });
const clearAuthCookie = (res) => res.clearCookie(COOKIE, cookieOpts());

const extract = (req) => {
  const h = req.get("authorization");
  return req.get("auth-token") /* legacy header */ || (h && h.startsWith("Bearer ") ? h.slice(7) : null) || req.cookies?.[COOKIE] || null;
};

async function load(req) {
  const token = extract(req);
  if (!token) throw new AppError("Login to access features :)", 401);
  let d;
  try { d = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }); }
  catch (e) { throw new AppError(e.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Invalid token", 401); }
  const user = await User.findById(d.id || d.userDetails?._id); // role & status always come from the DB, never from the token
  if (!user) throw new AppError("User not found", 401);
  if (user.isBlocked) throw new AppError("This account has been suspended", 403);
  if (user.passwordChangedAt && d.iat * 1000 < user.passwordChangedAt.getTime()) throw new AppError("Password was changed. Please log in again.", 401);
  return user;
}
const authenticate = asyncHandler(async (req, res, next) => { req.user = await load(req); next(); });
const optionalAuth = asyncHandler(async (req, res, next) => { try { req.user = await load(req); } catch { /* anonymous */ } next(); });
const requireAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : next(new AppError("Admin access required", 403)));
const requireVerified = (req, res, next) => (!env.requireEmailVerification || req.user.emailVerified ? next() : next(new AppError("Please verify your email first", 403)));

module.exports = { COOKIE, signToken, setAuthCookie, clearAuthCookie, authenticate, optionalAuth, requireAdmin, requireVerified };
