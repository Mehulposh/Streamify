const mongoose = require("mongoose");
const { Schema } = mongoose;
const ref = (m, extra = {}) => ({ type: Schema.Types.ObjectId, ref: m, ...extra });

// ---------------- User ----------------
const userSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  language: { type: String, enum: ["en", "hi"], default: "en" },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, select: false }, emailVerifyExpires: { type: Date, select: false },
  resetToken: { type: String, select: false }, resetExpires: { type: Date, select: false },
  passwordChangedAt: Date, failedLogins: { type: Number, default: 0 }, lockUntil: Date,
  isBlocked: { type: Boolean, default: false }, blockedReason: String,
  googleId: { type: String, unique: true, sparse: true },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: ref("User"),
  trialStartedAt: Date,                       // free trial is tracked on the server now
  shareActivity: { type: Boolean, default: false }, // friends can see my ratings / watched
}, { timestamps: true });
userSchema.set("toJSON", { transform: (d, r) => { ["password", "emailVerifyToken", "emailVerifyExpires", "resetToken", "resetExpires", "failedLogins", "lockUntil", "__v"].forEach((k) => delete r[k]); return r; } });

// ---------------- Profile (Netflix-style) ----------------
const profileSchema = new Schema({
  userId: ref("User", { required: true, index: true }),
  name: { type: String, required: true, trim: true, maxlength: 30 },
  avatar: { type: String, default: "avatar1", maxlength: 40 },
  isKids: { type: Boolean, default: false },
  language: { type: String, default: "en-US", match: /^[a-z]{2}-[A-Z]{2}$/ },
  pinHash: { type: String, select: false }, hasPin: { type: Boolean, default: false },
  dailyLimitMinutes: { type: Number, default: 0, min: 0, max: 1440 }, // 0 = no limit
}, { timestamps: true });
profileSchema.set("toJSON", { transform: (d, r) => { delete r.pinHash; delete r.__v; return r; } });

// ---------------- Watchlist (kept as "movies" collection) ----------------
const movieSchema = new Schema({
  userId: { type: String, required: true, index: true }, // string kept for old data
  profileId: { type: Schema.Types.ObjectId, ref: "Profile", index: true },
  title: { type: String, required: true }, id: { type: Number, required: true },
  genre_ids: { type: Array, default: [] }, poster_path: String,
  release_date: { type: String, default: "" }, vote_average: { type: Number, default: 0 },
  mediaType: { type: String, required: true }, saveId: { type: String, required: true, unique: true },
  watched: { type: Boolean, default: false }, releaseNotified: { type: Boolean, default: false },
}, { timestamps: true });
movieSchema.index({ profileId: 1, id: 1, mediaType: 1 });

// ---------------- Subscription / Payment / Coupon ----------------
const subscriptionSchema = new Schema({
  user: ref("User", { required: true }),
  plan: { type: String, enum: ["1month", "3months", "6months", "1year", "trial", "bonus"], required: true },
  price: { type: Number, required: true, min: 0 },
  startDate: { type: Date, default: Date.now }, endDate: { type: Date, required: true },
  status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  source: { type: String, enum: ["payment", "coupon", "referral", "admin"], default: "payment" },
  paymentIds: [ref("Payment")], expiryReminderSent: { type: Boolean, default: false },
}, { timestamps: true });
// at most ONE active subscription per user (a new purchase extends it instead)
subscriptionSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
subscriptionSchema.index({ status: 1, endDate: 1 });

const paymentSchema = new Schema({
  userId: ref("User", { required: true, index: true }),
  plan: { type: String, required: true },
  baseAmount: Number, discount: { type: Number, default: 0 }, amount: { type: Number, required: true },
  couponCode: String,
  mode: { type: String, enum: ["razorpay", "mock", "free"], required: true },
  status: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created" },
  razorpayOrderId: { type: String, index: true }, razorpayPaymentId: String,
  invoiceNumber: { type: String, unique: true, sparse: true }, paidAt: Date,
}, { timestamps: true });

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ["percent", "flat", "trial"], required: true }, // trial = free days (redeem link)
  value: { type: Number, required: true, min: 1 },  // percent | rupees | days
  maxDiscount: Number, plans: [String],
  maxUses: { type: Number, default: 0 }, usedCount: { type: Number, default: 0 }, usedBy: [ref("User")],
  expiresAt: Date, active: { type: Boolean, default: true },
}, { timestamps: true });

// ---------------- Engagement ----------------
const reviewSchema = new Schema({
  reviewId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true }, username: { type: String, required: true },
  movieId: { type: Number, required: true }, mediaType: { type: String, enum: ["movie", "tv"], default: "movie" },
  review: { type: String, required: true, maxlength: 2000 },
  datetime: { type: Date, default: Date.now },
  helpfulBy: [String],
  reports: [{ _id: false, userId: String, reason: { type: String, maxlength: 200 }, at: { type: Date, default: Date.now } }],
  status: { type: String, enum: ["visible", "pending", "hidden"], default: "visible" },
}, { timestamps: true });
reviewSchema.index({ movieId: 1, mediaType: 1, status: 1 });

const ratingSchema = new Schema({
  userId: ref("User", { required: true }), profileId: ref("Profile", { required: true }),
  tmdbId: { type: Number, required: true }, mediaType: { type: String, enum: ["movie", "tv"], required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  title: String, poster_path: String, genre_ids: { type: Array, default: [] },
}, { timestamps: true });
ratingSchema.index({ profileId: 1, mediaType: 1, tmdbId: 1 }, { unique: true });
ratingSchema.index({ mediaType: 1, tmdbId: 1 });

const historySchema = new Schema({
  userId: ref("User", { required: true }), profileId: ref("Profile", { required: true }),
  tmdbId: { type: Number, required: true }, mediaType: { type: String, enum: ["movie", "tv"], required: true },
  title: String, poster_path: String, backdrop_path: String, genre_ids: { type: Array, default: [] },
  season: Number, episode: Number,
  progressSeconds: { type: Number, default: 0, min: 0 }, durationSeconds: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: false }, views: { type: Number, default: 1 },
}, { timestamps: true });
historySchema.index({ profileId: 1, mediaType: 1, tmdbId: 1 }, { unique: true });
historySchema.index({ profileId: 1, updatedAt: -1 });

const watchTimeSchema = new Schema({ profileId: ref("Profile", { required: true }), date: { type: String, required: true }, seconds: { type: Number, default: 0 } });
watchTimeSchema.index({ profileId: 1, date: 1 }, { unique: true });
watchTimeSchema.index({ date: 1 }); // old rows are purged by jobs/scheduler.js

const listItem = new Schema({ _id: false, tmdbId: Number, mediaType: String, title: String, poster_path: String, vote_average: Number, addedAt: { type: Date, default: Date.now } });
const listSchema = new Schema({
  userId: ref("User", { required: true, index: true }), profileId: ref("Profile", { required: true, index: true }),
  name: { type: String, required: true, trim: true, maxlength: 60 }, description: { type: String, maxlength: 300, default: "" },
  isPublic: { type: Boolean, default: false }, shareId: { type: String, unique: true, required: true },
  items: { type: [listItem], default: [] },
}, { timestamps: true });

const searchHistorySchema = new Schema({ profileId: ref("Profile", { required: true }), term: { type: String, required: true, maxlength: 100 } }, { timestamps: true });
searchHistorySchema.index({ profileId: 1, term: 1 }, { unique: true });

const notificationSchema = new Schema({
  userId: ref("User", { required: true }), type: String, title: String, body: String, link: String, read: { type: Boolean, default: false },
}, { timestamps: true });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const followSchema = new Schema({ follower: ref("User", { required: true }), following: ref("User", { required: true }) }, { timestamps: true });
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 });

const activitySchema = new Schema({
  userId: ref("User", { required: true, index: true }), type: { type: String, enum: ["rated", "reviewed", "watched", "list"], required: true },
  payload: { type: Object, default: {} }, createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

module.exports = {
  User: mongoose.model("User", userSchema), Profile: mongoose.model("Profile", profileSchema),
  Movie: mongoose.model("movies", movieSchema), Subscription: mongoose.model("Subscription", subscriptionSchema),
  Payment: mongoose.model("Payment", paymentSchema), Coupon: mongoose.model("Coupon", couponSchema),
  Review: mongoose.model("Review", reviewSchema), Rating: mongoose.model("Rating", ratingSchema),
  History: mongoose.model("History", historySchema), WatchTime: mongoose.model("WatchTime", watchTimeSchema),
  List: mongoose.model("List", listSchema), SearchHistory: mongoose.model("SearchHistory", searchHistorySchema),
  Notification: mongoose.model("Notification", notificationSchema), Follow: mongoose.model("Follow", followSchema),
  Activity: mongoose.model("Activity", activitySchema),
};
