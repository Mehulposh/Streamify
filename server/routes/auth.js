const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const env = require("../config/env");
const { User, Profile } = require("../models");
const { z, email, password, username } = require("../utils/schemas");
const { AppError, asyncHandler, sha256, randomToken } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, signToken, setAuthCookie, clearAuthCookie } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { sendMail } = require("../utils/notify");
const { getAccess } = require("../services/billing");
const { deleteUserData } = require("../services/misc");

const ROUNDS = 12, MAX_FAILS = 5, LOCK_MIN = 15;
const DUMMY = bcrypt.hashSync("not-a-real-password", ROUNDS); // equalises timing for unknown emails
const link = (p, t) => `${env.clientUrls[0]}${p}?token=${t}`;
const genCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();

// NOTE: validation / credential failures answer HTTP 200 + {status:false,msg} because the existing frontend
// reads that shape from a normal axios response. Everything else uses proper HTTP status codes.
const fail = (res, msg) => res.status(200).send({ status: false, msg });
const session = (res, user, code = 200) => {
  const token = signToken(user);
  setAuthCookie(res, token); // httpOnly cookie for the new frontend
  return res.status(code).send({ status: true, jwtToken: token /* legacy clients keep it in a cookie themselves */, userDetails: { username: user.username, _id: user._id, role: user.role } });
};

const registerSchema = z.object({ username, email, password, referralCode: z.string().trim().max(20).optional(), language: z.enum(["en", "hi"]).optional() });
// "role" is NOT accepted from the client any more: everyone starts as "user". Admins: ADMIN_REGISTRATION_KEY or `npm run create-admin`.
router.post("/register", authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { username: un, email: em, password: pw, referralCode, language } = req.body;
  if (await User.exists({ username: un })) return fail(res, "Username already used");
  if (await User.exists({ email: em })) return fail(res, "Email already used");
  const referrer = referralCode ? await User.findOne({ referralCode: referralCode.toUpperCase() }).select("_id") : null;
  const token = randomToken();
  const user = await User.create({ username: un, email: em, language, password: await bcrypt.hash(pw, ROUNDS), referralCode: genCode(), referredBy: referrer?._id,
    emailVerifyToken: sha256(token), emailVerifyExpires: new Date(Date.now() + 24 * 3600e3) });
  await Profile.create({ userId: user._id, name: un });
  sendMail(em, "Verify your email", `Welcome to Streamify, ${un}!\nVerify your email: ${link("/verify-email", token)}\nThe link expires in 24 hours.`).catch(() => {});
  session(res, user, 201);
}));

router.post("/login", authLimiter, validate(z.object({ email, password: z.string().min(1).max(72) })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");
  if (user?.lockUntil && user.lockUntil > new Date()) return fail(res, "Too many failed attempts. Try again in a few minutes.");
  const ok = await bcrypt.compare(req.body.password, user?.password || DUMMY);
  if (!user || !ok) { // same message either way: no more "Email is not registered"
    if (user) { user.failedLogins += 1; if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MIN * 60e3); user.failedLogins = 0; } await user.save(); }
    return fail(res, "Invalid email or password");
  }
  if (user.isBlocked) return fail(res, "This account has been suspended");
  if (user.failedLogins || user.lockUntil) { user.failedLogins = 0; user.lockUntil = undefined; await user.save(); }
  session(res, user);
}));

// ---- Google sign-in (ID token from Google Identity Services) ----
router.post("/google", authLimiter, validate(z.object({ idToken: z.string().min(20).max(4096) })), asyncHandler(async (req, res) => {
  if (!env.googleClientId) throw new AppError("Google sign-in is not enabled", 501);
  let g;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.idToken)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("bad token");
    g = await r.json();
  } catch { throw new AppError("Google sign-in failed", 401); }
  if (g.aud !== env.googleClientId || String(g.email_verified) !== "true" || !g.email) throw new AppError("Google sign-in failed", 401);
  const mail = String(g.email).toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: g.sub }, { email: mail }] });
  if (user && user.isBlocked) throw new AppError("This account has been suspended", 403);
  if (user && !user.googleId) { user.googleId = g.sub; user.emailVerified = true; await user.save(); }
  if (!user) {
    const base = mail.split("@")[0].replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 14) || "user";
    let name = base.length < 3 ? base + "user" : base;
    while (await User.exists({ username: name })) name = `${base.slice(0, 14)}${crypto.randomInt(100, 9999)}`;
    user = await User.create({ username: name.slice(0, 20), email: mail, googleId: g.sub, emailVerified: true, referralCode: genCode(), password: await bcrypt.hash(randomToken(), ROUNDS) });
    await Profile.create({ userId: user._id, name: user.username });
  }
  session(res, user);
}));

router.post("/logout", (req, res) => { clearAuthCookie(res); res.send({ status: true, msg: "Logged out" }); });

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const a = await getAccess(req.user);
  res.send({ status: true, user: req.user.toJSON(), access: { hasAccess: a.hasAccess, reason: a.reason, trialRemainingSeconds: a.trialRemainingSeconds, endDate: a.subscription?.endDate } });
}));

router.post("/verify-email", authLimiter, validate(z.object({ token: z.string().length(64) })), asyncHandler(async (req, res) => {
  const u = await User.findOne({ emailVerifyToken: sha256(req.body.token), emailVerifyExpires: { $gt: new Date() } }).select("+emailVerifyToken +emailVerifyExpires");
  if (!u) throw new AppError("Verification link is invalid or has expired", 400);
  u.emailVerified = true; u.emailVerifyToken = undefined; u.emailVerifyExpires = undefined; await u.save();
  res.send({ status: true, msg: "Email verified" });
}));
router.post("/resend-verification", authenticate, authLimiter, asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return res.send({ status: true, msg: "Already verified" });
  const t = randomToken();
  await User.updateOne({ _id: req.user._id }, { emailVerifyToken: sha256(t), emailVerifyExpires: new Date(Date.now() + 24 * 3600e3) });
  sendMail(req.user.email, "Verify your email", `Verify your email: ${link("/verify-email", t)}`).catch(() => {});
  res.send({ status: true, msg: "Verification email sent" });
}));

router.post("/forgot-password", authLimiter, validate(z.object({ email })), asyncHandler(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (u && !u.isBlocked) {
    const t = randomToken();
    await User.updateOne({ _id: u._id }, { resetToken: sha256(t), resetExpires: new Date(Date.now() + 3600e3) });
    sendMail(u.email, "Reset your password", `Reset your password (valid 1 hour): ${link("/reset-password", t)}\nIgnore this email if you did not ask for it.`).catch(() => {});
  }
  res.send({ status: true, msg: "If that email exists, a reset link has been sent." });
}));
const setPassword = async (user, plain) => {
  user.password = await bcrypt.hash(plain, ROUNDS);
  user.passwordChangedAt = new Date(Date.now() - 2000); // invalidates every older token
  user.failedLogins = 0; user.lockUntil = undefined;
};
router.post("/reset-password", authLimiter, validate(z.object({ token: z.string().length(64), password })), asyncHandler(async (req, res) => {
  const u = await User.findOne({ resetToken: sha256(req.body.token), resetExpires: { $gt: new Date() } }).select("+resetToken +resetExpires");
  if (!u) throw new AppError("Reset link is invalid or has expired", 400);
  await setPassword(u, req.body.password); u.resetToken = undefined; u.resetExpires = undefined; await u.save();
  res.send({ status: true, msg: "Password updated. Please log in." });
}));
router.post("/change-password", authenticate, authLimiter, validate(z.object({ currentPassword: z.string().min(1).max(72), newPassword: password })), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select("+password");
  if (!(await bcrypt.compare(req.body.currentPassword, u.password))) throw new AppError("Current password is incorrect", 400);
  await setPassword(u, req.body.newPassword); await u.save();
  session(res, u);
}));

router.patch("/settings", authenticate, validate(z.object({ language: z.enum(["en", "hi"]).optional(), shareActivity: z.boolean().optional() })), asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body); await req.user.save();
  res.send({ status: true, user: req.user.toJSON() });
}));

// Delete my account + all personal data (password, or typing DELETE for Google-only accounts)
router.delete("/account", authenticate, authLimiter, validate(z.object({ password: z.string().max(72).optional(), confirm: z.string().max(10).optional() })), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select("+password");
  const ok = req.body.password ? await bcrypt.compare(req.body.password, u.password) : u.googleId && req.body.confirm === "DELETE";
  if (!ok) throw new AppError("Confirmation failed", 400);
  if (u.role === "admin") throw new AppError("Admin accounts cannot be self-deleted", 400);
  await deleteUserData(u._id);
  clearAuthCookie(res);
  res.send({ status: true, msg: "Your account and personal data were deleted" });
}));

module.exports = router;
module.exports.setPassword = setPassword;
