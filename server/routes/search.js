const router = require("express").Router();
const { SearchHistory } = require("../models");
const { z } = require("../utils/schemas");
const { tmdb } = require("../utils/tmdb");
const { filterKids, buildTmdbParams } = require("../utils/pure");
const { asyncHandler, escapeRegex } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { tmdbLimiter } = require("../middlewares/security");
router.use(authenticate, withProfile);

const term = z.string().trim().min(1).max(100);
router.get("/history", asyncHandler(async (req, res) => res.send({ status: true, terms: (await SearchHistory.find({ profileId: req.profile._id }).sort({ updatedAt: -1 }).limit(10).lean()).map((t) => t.term) })));
router.post("/history", validate(z.object({ term })), asyncHandler(async (req, res) => {
  await SearchHistory.findOneAndUpdate({ profileId: req.profile._id, term: req.body.term.toLowerCase() }, { $set: { updatedAt: new Date() } }, { upsert: true });
  const extra = await SearchHistory.find({ profileId: req.profile._id }).sort({ updatedAt: -1 }).skip(20).select("_id").lean(); // keep the last 20
  if (extra.length) await SearchHistory.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
  res.send({ status: true });
}));
router.delete("/history", asyncHandler(async (req, res) => { await SearchHistory.deleteMany({ profileId: req.profile._id }); res.send({ status: true }); }));
router.delete("/history/:term", asyncHandler(async (req, res) => { await SearchHistory.deleteOne({ profileId: req.profile._id, term: req.params.term.toLowerCase() }); res.send({ status: true }); }));

// type-ahead: TMDB titles + my recent searches that match
router.get("/suggest", tmdbLimiter, asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (q.length < 2) return res.send({ status: true, suggestions: [], recent: [] });
  const params = buildTmdbParams("/search/multi", { query: q }, { language: req.profile.language, kids: req.profile.isKids });
  let data = await tmdb("/search/multi", params, 600);
  if (req.profile.isKids) data = filterKids(data);
  const recent = await SearchHistory.find({ profileId: req.profile._id, term: new RegExp("^" + escapeRegex(q.toLowerCase())) }).sort({ updatedAt: -1 }).limit(3).lean();
  res.send({ status: true, recent: recent.map((r) => r.term),
    suggestions: data.results.filter((r) => ["movie", "tv"].includes(r.media_type)).slice(0, 8).map((r) => ({ id: r.id, mediaType: r.media_type, title: r.title || r.name, year: (r.release_date || r.first_air_date || "").slice(0, 4), poster_path: r.poster_path })) });
}));
module.exports = router;
