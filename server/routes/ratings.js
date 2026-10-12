const router = require("express").Router();
const { Rating } = require("../models");
const { z, mediaType, tmdbId } = require("../utils/schemas");
const { asyncHandler, pageOpts, pagination, AppError } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { writeLimiter } = require("../middlewares/security");
const { recsCache, logActivity } = require("../services/misc");
router.use(authenticate, withProfile);

const summarize = async (mt, id) => {
  const [r] = await Rating.aggregate([{ $match: { mediaType: mt, tmdbId: id } }, { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } }]);
  return { average: r ? Math.round(r.avg * 10) / 10 : 0, count: r ? r.count : 0 };
};

router.put("/", writeLimiter, validate(z.object({ tmdbId, mediaType, stars: z.number().int().min(1).max(5), title: z.string().max(200).optional(), poster_path: z.string().max(200).nullish(), genre_ids: z.array(z.number().int()).max(20).optional() })), asyncHandler(async (req, res) => {
  const { tmdbId: id, mediaType: mt, stars, ...meta } = req.body;
  await Rating.findOneAndUpdate({ profileId: req.profile._id, mediaType: mt, tmdbId: id }, { $set: { userId: req.user._id, stars, ...meta } }, { upsert: true, setDefaultsOnInsert: true });
  recsCache.invalidate(req.profile._id);
  logActivity(req.user, "rated", { tmdbId: id, mediaType: mt, stars, title: meta.title, poster_path: meta.poster_path });
  res.send({ status: true, mine: stars, ...(await summarize(mt, id)) });
}));

router.get("/mine", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 20, 100), f = { profileId: req.profile._id };
  const [items, total] = await Promise.all([Rating.find(f).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).lean(), Rating.countDocuments(f)]);
  res.send({ status: true, items, pagination: pagination(p, total) });
}));
router.get("/summary/:mediaType/:id", asyncHandler(async (req, res) => {
  if (!["movie", "tv"].includes(req.params.mediaType)) throw new AppError("Invalid media type", 400);
  const id = parseInt(req.params.id, 10);
  const mine = await Rating.findOne({ profileId: req.profile._id, mediaType: req.params.mediaType, tmdbId: id }).select("stars").lean();
  res.send({ status: true, mine: mine?.stars || 0, ...(await summarize(req.params.mediaType, id)) });
}));
router.delete("/:mediaType/:id", asyncHandler(async (req, res) => {
  await Rating.deleteOne({ profileId: req.profile._id, mediaType: req.params.mediaType, tmdbId: parseInt(req.params.id, 10) });
  recsCache.invalidate(req.profile._id);
  res.send({ status: true });
}));
module.exports = router;
