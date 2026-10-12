// Watchlist. Same URLs as before (/api/saved/...) but per-profile and validated.
const router = require("express").Router();
const crypto = require("crypto");
const { Movie } = require("../models");
const { z, mediaType, tmdbId, bool } = require("../utils/schemas");
const { asyncHandler, pageOpts, pagination } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { recsCache } = require("../services/misc");
router.use(authenticate, withProfile);

const addSchema = z.object({ id: tmdbId, mediaType: mediaType.default("movie"), title: z.string().trim().min(1).max(200), genre_ids: z.array(z.number().int()).max(20).default([]),
  poster_path: z.string().max(200).nullish(), release_date: z.string().max(10).default(""), vote_average: z.number().min(0).max(10).default(0) });

router.post("/addmovie", validate(addSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  if (await Movie.exists({ profileId: req.profile._id, id: b.id, mediaType: b.mediaType })) return res.send({ status: false, msg: "Movie is already saved :)" });
  await Movie.create({ ...b, poster_path: b.poster_path || undefined, userId: String(req.user._id), profileId: req.profile._id, saveId: crypto.randomUUID() });
  recsCache.invalidate(req.profile._id);
  res.send({ status: true, msg: "Movie Saved successfully :)" });
}));

router.get("/getmovies", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 500, 500), f = { profileId: req.profile._id };
  if (req.query.watched === "true") f.watched = true; else if (req.query.watched === "false") f.watched = false;
  if (["movie", "tv"].includes(req.query.mediaType)) f.mediaType = req.query.mediaType;
  const sort = { added: { createdAt: -1 }, title: { title: 1 }, rating: { vote_average: -1 } }[req.query.sort] || { createdAt: -1 };
  const [movies, total] = await Promise.all([Movie.find(f).sort(sort).skip(p.skip).limit(p.limit).lean(), Movie.countDocuments(f)]);
  res.send({ status: true, movies, pagination: pagination(p, total) });
}));

router.delete("/deletemovie/:id", asyncHandler(async (req, res) => {
  const f = { profileId: req.profile._id, id: parseInt(req.params.id, 10) };
  if (["movie", "tv"].includes(req.query.mediaType)) f.mediaType = req.query.mediaType;
  await Movie.deleteMany(f);
  recsCache.invalidate(req.profile._id);
  res.send({ status: true, msg: "Movie is unsaved successfully" });
}));

router.put("/watch/:id", validate(z.object({ watched: bool.default(true) })), asyncHandler(async (req, res) => {
  const f = { profileId: req.profile._id, id: parseInt(req.params.id, 10) };
  if (["movie", "tv"].includes(req.query.mediaType)) f.mediaType = req.query.mediaType;
  const m = await Movie.findOneAndUpdate(f, { watched: req.body.watched }, { new: true });
  if (!m) return res.send({ status: false, msg: "Movie not found in watchlist" });
  recsCache.invalidate(req.profile._id);
  res.send({ status: true, msg: req.body.watched ? "Movie marked as watched" : "Movie marked as not watched" });
}));
module.exports = router;
