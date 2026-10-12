const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const isProd = process.env.NODE_ENV === "production";
const mongoUri = process.env.MONGO_DB || process.env.MONGODB_CONNECTION_LINK; // old name still accepted
const fatal = (m) => { console.error(`FATAL: ${m}`); process.exit(1); };
if (!mongoUri) fatal("MONGO_DB is not set. Copy .env.example to .env.");
if (!process.env.JWT_SECRET) fatal("JWT_SECRET is not set. Copy .env.example to .env.");
if (isProd && process.env.JWT_SECRET.length < 32) fatal("JWT_SECRET must be at least 32 characters in production.");

const list = (v, d = "") => (v || d).split(",").map((s) => s.trim()).filter(Boolean);
const razorpayOn = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const paymentMode = (process.env.PAYMENT_MODE || (razorpayOn ? "razorpay" : isProd ? "disabled" : "mock")).toLowerCase();
if (!["razorpay", "mock", "disabled"].includes(paymentMode)) fatal("PAYMENT_MODE must be razorpay, mock or disabled.");
if (isProd && paymentMode === "mock") fatal("PAYMENT_MODE=mock is not allowed in production (it would give away free subscriptions).");
if (paymentMode === "razorpay" && !razorpayOn) fatal("PAYMENT_MODE=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");

module.exports = {
  isProd, mongoUri, paymentMode,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || "7d",
  clientUrls: list(process.env.CLIENT_URL, "http://localhost:5173"),
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax",
  tmdbToken: process.env.TMDB_TOKEN || process.env.VITE_APP_TMDB_TOKEN || "",
  adminKey: process.env.ADMIN_REGISTRATION_KEY || "",
  trialMinutes: Number(process.env.TRIAL_MINUTES ?? 5),
  requireEmailVerification: String(process.env.REQUIRE_EMAIL_VERIFICATION).toLowerCase() === "true",
  referralBonusDays: Number(process.env.REFERRAL_BONUS_DAYS ?? 7),
  extraBlockedWords: list(process.env.EXTRA_BLOCKED_WORDS),
  razorpay: { keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET },
  smtp: { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM || "Streamify <no-reply@localhost>" },
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
};
