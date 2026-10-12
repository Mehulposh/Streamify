const env = require("./config/env");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { sanitize, globalLimiter } = require("./middlewares/security");
const { notFound, errorHandler } = require("./middlewares/error");
const { authenticate, requireAdmin } = require("./middlewares/auth");
const { AppError } = require("./utils/helpers");
const admin = require("./routes/admin");

const app = express();
app.disable("x-powered-by");
if (env.trustProxy) app.set("trust proxy", env.trustProxy);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || env.clientUrls.includes(origin) ? cb(null, true) : cb(new AppError("Origin not allowed", 403))), // was cors() = any website
  credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "auth-token", "x-profile-id", "x-profile-token", "X-Admin-Key"],
}));
app.use(globalLimiter);
app.use(express.json({ limit: "100kb", verify: (req, res, buf) => { if (req.originalUrl.startsWith("/api/payments/webhook")) req.rawBody = buf; } }));
app.use(cookieParser());
app.use(sanitize);

app.get("/health", (req, res) => res.send({ status: "ok", db: mongoose.connection.readyState === 1 }));

// legacy URL used by the current admin screen (now admin-only)
app.use("/api/auth/users", authenticate, requireAdmin, admin.usersRouter);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/saved", require("./routes/saved"));          // watchlist (legacy URLs)
app.use("/api/review", require("./routes/reviews"));       // reviews (legacy URLs)
app.use("/api/subscription", require("./routes/subscription"));
// new
app.use("/api/access", require("./routes/access"));
app.use("/api/profiles", require("./routes/profiles"));
app.use("/api/history", require("./routes/history"));
app.use("/api/ratings", require("./routes/ratings"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/coupons", require("./routes/coupons"));
app.use("/api/tmdb", require("./routes/tmdb"));
app.use("/api/recommendations", require("./routes/recommendations"));
app.use("/api/lists", require("./routes/lists"));
app.use("/api/search", require("./routes/search"));
app.use("/api/social", require("./routes/social"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/admin", admin);

app.use(notFound);
app.use(errorHandler);

connectDB().then(() => {
  const server = app.listen(env.port, () => console.log(`Streamify API running on port ${env.port} (payments: ${env.paymentMode})`));
  require("./jobs/scheduler").start();
  const stop = () => server.close(() => mongoose.connection.close().then(() => process.exit(0)));
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
});
process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));
