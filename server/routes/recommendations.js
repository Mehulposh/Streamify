// "For you" rows built from what THIS profile saved, watched and rated.
const router = require("express").Router();
const { Movie, History, Rating } = require("../models");
const { tmdb } = require("../utils/tmdb");
const { topGenres, filterKids } = require("../utils/pure");
const { asyncHandler } = require("../utils/helpers");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { recsCache } = require("../services/misc");
router.use(authenticate, withProfile);

router.get("/", asyncHandler(async (req, res) => {
  const profile = req.profile, cached = recsCache.get(profile._id);
  if (cached) return res.send({ status: true, rows: cached, cached: true });
  const language = profile.language;
  const [wl, hist, rated] = await Promise.all([
    Movie.find({ profileId: profile._id }).select("id mediaType genre_ids watched").lean(),
    History.find({ profileId: profile._id }).sort({ updatedAt: -1 }).limit(100).lean(),
    Rating.find({ profileId: profile._id }).lean(),
  ]);
  const signals = [
    ...wl.map((m) => ({ genre_ids: m.genre_ids, weight: m.watched ? 2 : 1 })),
    ...hist.map((h) => ({ genre_ids: h.genre_ids, weight: h.completed ? 3 : 2 })),
    ...rated.map((r) => ({ genre_ids: r.genre_ids, weight: r.stars >= 4 ? r.stars - 1 : r.stars <= 2 ? -(3 - r.stars) : 0 })), // low ratings push a genre down
  ];
  const seen = new Set([...wl.map((m) => `${m.mediaType}:${m.id}`), ...hist.map((h) => `${h.mediaType}:${h.tmdbId}`), ...rated.map((r) => `${r.mediaType}:${r.tmdbId}`)]);
  const top = topGenres(signals.filter((s) => s.weight > 0), 3);
  const rows = [];
  const add = (title, type, results) => {
    let r = (results || []).map((x) => ({ ...x, media_type: x.media_type || type })).filter((x) => !seen.has(`${x.media_type}:${x.id}`));
    if (profile.isKids) r = filterKids({ results: r }).results;
    if (r.length) rows.push({ title, items: r.slice(0, 20) });
  };
  const discover = async (type, genres) => {
    const p = { language, include_adult: "false", sort_by: "popularity.desc", "vote_count.gte": 200, with_genres: genres };
    if (profile.isKids && type === "movie") { p.certification_country = "US"; p["certification.lte"] = "PG"; }
    return (await tmdb(`/discover/${type}`, p, 1800)).results;
  };
  try {
    if (top.length) {
      const names = Object.fromEntries((await tmdb("/genre/movie/list", { language }, 86400)).genres.map((g) => [g.id, g.name]));
      add("Picked for you", "movie", await discover("movie", top.slice(0, 2).map((g) => g.id).join("|")));
      add("Series for you", "tv", await discover("tv", top.slice(0, 2).map((g) => g.id).join("|")));
      for (const g of top.slice(0, 2)) if (names[g.id]) add(`Because you like ${names[g.id]}`, "movie", await discover("movie", String(g.id)));
    }
    const last = hist[0];
    if (last) add(`Because you watched ${last.title || "a recent title"}`, last.mediaType, (await tmdb(`/${last.mediaType}/${last.tmdbId}/recommendations`, { language }, 1800)).results);
    if (!rows.length) add("Trending now", "movie", (await tmdb("/trending/all/week", { language }, 900)).results);
  } catch (e) { if (!rows.length) throw e; } // partial rows are fine, TMDB hiccups should not 500 the page
  recsCache.set(profile._id, rows);
  res.send({ status: true, rows, basedOn: { genres: top, signals: signals.length } });
}));
module.exports = router;
