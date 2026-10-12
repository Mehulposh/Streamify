// Reviews. Old URLs kept. editreview / deletereview now require login (they crashed with HTTP 500 before).
const router = require("express").Router();
const crypto = require("crypto");
const env = require("../config/env");
const { Review, Rating } = require("../models");
const { z, mediaType, tmdbId } = require("../utils/schemas");
const { containsProfanity } = require("../utils/pure");
const { asyncHandler, pageOpts, pagination, AppError } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { writeLimiter } = require("../middlewares/security");
const { notify } = require("../utils/notify");
const { logActivity } = require("../services/misc");

const AUTO_HIDE_REPORTS = 3;
const text = z.string().trim().min(1).max(2000);
const needsModeration = (t) => containsProfanity(t, env.extraBlockedWords);

router.post("/addreview", authenticate, writeLimiter, validate(z.object({ movieId: tmdbId, mediaType: mediaType.default("movie"), review: text, stars: z.number().int().min(1).max(5).optional() })), asyncHandler(async (req, res) => {
  const { movieId, mediaType: mt, review, stars } = req.body;
  if (await Review.exists({ userId: String(req.user._id), movieId, mediaType: mt })) throw new AppError("You already reviewed this title. Edit your review instead.", 409);
  const pending = needsModeration(review);
  const doc = await Review.create({ reviewId: crypto.randomUUID(), userId: String(req.user._id), username: req.user.username, movieId, mediaType: mt, review, status: pending ? "pending" : "visible" });
  if (pending) notify(req.user._id, { type: "review_hidden" }); else logActivity(req.user, "reviewed", { tmdbId: movieId, mediaType: mt });
  res.status(201).send({ status: true, reviewId: doc.reviewId, review: doc, moderation: pending, msg: pending ? "Your review will appear after moderation." : undefined });
}));

router.put("/editreview", authenticate, writeLimiter, validate(z.object({ reviewId: z.string().min(10).max(60), review: text })), asyncHandler(async (req, res) => {
  const r = await Review.findOne({ reviewId: req.body.reviewId, userId: String(req.user._id) });
  if (!r) throw new AppError("Review not found or not authorized", 404);
  r.review = req.body.review; r.datetime = new Date(); r.status = needsModeration(req.body.review) ? "pending" : (r.status === "hidden" ? "hidden" : "visible");
  await r.save();
  res.send({ status: true, moderation: r.status === "pending" });
}));

router.delete("/deletereview/:reviewId", authenticate, asyncHandler(async (req, res) => {
  const f = { reviewId: req.params.reviewId };
  if (req.user.role !== "admin") f.userId = String(req.user._id); // owner, or an admin moderating
  const r = await Review.deleteOne(f);
  if (!r.deletedCount) throw new AppError("Review not found or not authorized", 404);
  res.send({ status: true });
}));

// public (login optional so we can flag which reviews *I* marked helpful)
router.get("/getreviews/:movieId", optionalAuth, asyncHandler(async (req, res) => {
  const movieId = parseInt(req.params.movieId, 10), mt = req.query.mediaType === "tv" ? "tv" : "movie";
  if (!Number.isFinite(movieId)) throw new AppError("Invalid movie id", 400);
  const p = pageOpts(req.query, 20, 100), f = { movieId, mediaType: mt, status: "visible" };
  const me = req.user ? String(req.user._id) : null;
  const page = req.query.sort === "helpful"
    ? Review.aggregate([{ $match: f }, { $addFields: { hc: { $size: "$helpfulBy" } } }, { $sort: { hc: -1, datetime: -1 } }, { $skip: p.skip }, { $limit: p.limit }])
    : Review.find(f).sort({ datetime: -1 }).skip(p.skip).limit(p.limit).lean();
  const [rows, total, [rs]] = await Promise.all([
    page, Review.countDocuments(f),
    Rating.aggregate([{ $match: { mediaType: mt, tmdbId: movieId } }, { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } }]),
  ]);
  res.send({ status: true, pagination: pagination(p, total), summary: { average: rs ? Math.round(rs.avg * 10) / 10 : 0, ratings: rs ? rs.count : 0 },
    reviews: rows.map(({ helpfulBy, reports, ...r }) => ({ ...r, helpfulCount: helpfulBy.length, iMarkedHelpful: !!me && helpfulBy.includes(me) })) });
}));

router.post("/:reviewId/helpful", authenticate, writeLimiter, asyncHandler(async (req, res) => {
  const r = await Review.findOne({ reviewId: req.params.reviewId, status: "visible" });
  if (!r) throw new AppError("Review not found", 404);
  const me = String(req.user._id);
  if (r.userId === me) throw new AppError("You cannot mark your own review", 400);
  const has = r.helpfulBy.includes(me);
  r.helpfulBy = has ? r.helpfulBy.filter((x) => x !== me) : [...r.helpfulBy, me];
  await r.save();
  if (!has) notify(r.userId, { type: "review_helpful", params: { title: "a title" } });
  res.send({ status: true, helpful: !has, helpfulCount: r.helpfulBy.length });
}));

router.post("/:reviewId/report", authenticate, writeLimiter, validate(z.object({ reason: z.string().trim().max(200).optional() })), asyncHandler(async (req, res) => {
  const r = await Review.findOne({ reviewId: req.params.reviewId });
  if (!r) throw new AppError("Review not found", 404);
  const me = String(req.user._id);
  if (r.userId === me) throw new AppError("You cannot report your own review", 400);
  if (!r.reports.some((x) => x.userId === me)) r.reports.push({ userId: me, reason: req.body.reason });
  if (r.reports.length >= AUTO_HIDE_REPORTS && r.status === "visible") { r.status = "hidden"; notify(r.userId, { type: "review_hidden" }); } // pulled for moderator review
  await r.save();
  res.send({ status: true, msg: "Thanks, a moderator will take a look." });
}));
module.exports = router;
