// Watch history, "Continue watching" and playback start (server-side paywall + daily limit).
const router = require("express").Router();
const { History, WatchTime, Movie } = require("../models");
const { z, mediaType, tmdbId } = require("../utils/schemas");
const { COMPLETE_THRESHOLD } = require("../utils/constants");
const { dayStr } = require("../utils/pure");
const { asyncHandler, pageOpts, pagination, AppError } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { requireAccess } = require("../middlewares/access");
const { recsCache, logActivity, limitReached, todaySeconds } = require("../services/misc");
router.use(authenticate, withProfile);

const putSchema = z.object({ tmdbId, mediaType, title: z.string().trim().max(200).optional(), poster_path: z.string().max(200).nullish(), backdrop_path: z.string().max(200).nullish(),
  genre_ids: z.array(z.number().int()).max(20).optional(), season: z.number().int().min(0).max(100).optional(), episode: z.number().int().min(0).max(5000).optional(),
  progressSeconds: z.number().min(0).max(86400), durationSeconds: z.number().min(0).max(86400).default(0), deltaSeconds: z.number().min(0).max(600).default(0) });

// Player heartbeat: call every ~15 s with the position and how many seconds were watched since the last call
router.put("/", requireAccess, validate(putSchema), asyncHandler(async (req, res) => {
  const b = req.body, f = { profileId: req.profile._id, mediaType: b.mediaType, tmdbId: b.tmdbId };
  if (await limitReached(req.profile)) return res.status(403).send({ status: false, msg: "Daily watch limit reached for this profile", code: "DAILY_LIMIT", limitReached: true });
  const completed = b.durationSeconds > 0 && b.progressSeconds / b.durationSeconds >= COMPLETE_THRESHOLD;
  const set = { userId: req.user._id, progressSeconds: b.progressSeconds, durationSeconds: b.durationSeconds, completed };
  for (const k of ["title", "poster_path", "backdrop_path", "genre_ids", "season", "episode"]) if (b[k] !== undefined && b[k] !== null) set[k] = b[k];
  const prev = await History.findOne(f).select("completed").lean();
  const doc = await History.findOneAndUpdate(f, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true });
  let limit = false;
  if (b.deltaSeconds > 0) {
    const wt = await WatchTime.findOneAndUpdate({ profileId: req.profile._id, date: dayStr() }, { $inc: { seconds: b.deltaSeconds } }, { upsert: true, new: true });
    limit = !!req.profile.dailyLimitMinutes && wt.seconds >= req.profile.dailyLimitMinutes * 60;
  }
  if (completed && !prev?.completed) {
    await Movie.updateOne({ profileId: req.profile._id, id: b.tmdbId, mediaType: b.mediaType }, { watched: true }); // auto-tick the watchlist
    logActivity(req.user, "watched", { tmdbId: b.tmdbId, mediaType: b.mediaType, title: doc.title, poster_path: doc.poster_path });
  }
  recsCache.invalidate(req.profile._id);
  res.send({ status: true, completed, limitReached: limit });
}));

// Continue watching row
router.get("/continue", asyncHandler(async (req, res) => {
  const items = await History.find({ profileId: req.profile._id, completed: false, progressSeconds: { $gt: 10 } }).sort({ updatedAt: -1 }).limit(20).lean();
  res.send({ status: true, items: items.map((h) => ({ ...h, percent: h.durationSeconds ? Math.min(100, Math.round((h.progressSeconds / h.durationSeconds) * 100)) : 0 })) });
}));

router.get("/", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 20, 100), f = { profileId: req.profile._id };
  const [items, total] = await Promise.all([History.find(f).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).lean(), History.countDocuments(f)]);
  res.send({ status: true, items, pagination: pagination(p, total) });
}));
router.delete("/", asyncHandler(async (req, res) => { await History.deleteMany({ profileId: req.profile._id }); recsCache.invalidate(req.profile._id); res.send({ status: true, msg: "History cleared" }); }));
router.delete("/:mediaType/:id", asyncHandler(async (req, res) => {
  if (!["movie", "tv"].includes(req.params.mediaType)) throw new AppError("Invalid media type", 400);
  await History.deleteOne({ profileId: req.profile._id, mediaType: req.params.mediaType, tmdbId: parseInt(req.params.id, 10) });
  recsCache.invalidate(req.profile._id);
  res.send({ status: true });
}));

// Called when the user presses Play. Applies the paywall and the daily limit, returns where to resume.
router.post("/playback/start", requireAccess, validate(z.object({ tmdbId, mediaType })), asyncHandler(async (req, res) => {
  if (await limitReached(req.profile)) throw new AppError("Daily watch limit reached for this profile", 403, "DAILY_LIMIT");
  const h = await History.findOne({ profileId: req.profile._id, mediaType: req.body.mediaType, tmdbId: req.body.tmdbId }).lean();
  res.send({ status: true, allowed: true, reason: req.access.reason, trialRemainingSeconds: req.access.trialRemainingSeconds,
    resume: h && !h.completed ? { progressSeconds: h.progressSeconds, season: h.season, episode: h.episode } : null,
    usedTodaySeconds: await todaySeconds(req.profile._id) });
}));
module.exports = router;
