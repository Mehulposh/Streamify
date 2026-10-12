// TMDB proxy: the TMDB token stays on the server, only whitelisted endpoints/params pass, trailers need an active plan/trial,
// kids profiles get filtered results. Use e.g.  GET /api/tmdb/trending/all/day  or  /api/tmdb/discover/movie?genre=28&year=2024&minRating=7
const router = require("express").Router();
const { tmdb } = require("../utils/tmdb");
const { isAllowedTmdbPath, isGatedTmdbPath, buildTmdbParams, filterKids } = require("../utils/pure");
const { AppError, asyncHandler } = require("../utils/helpers");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { tmdbLimiter } = require("../middlewares/security");
const { getAccess } = require("../services/billing");
router.use(authenticate, withProfile, tmdbLimiter);

const ttlFor = (p) => (p === "/configuration" || p.startsWith("/genre/") ? 86400 : p.startsWith("/trending") ? 900 : 300);

router.get("/*", asyncHandler(async (req, res) => {
  const path = req.path.replace(/\/+$/, "");
  if (!isAllowedTmdbPath(path)) throw new AppError("Not found", 404);
  if (isGatedTmdbPath(path)) {
    const a = await getAccess(req.user);
    if (!a.hasAccess) throw new AppError("An active subscription or free trial is required", 402, "SUBSCRIPTION_REQUIRED");
  }
  const language = req.profile.language;
  const params = buildTmdbParams(path, req.query, { language, kids: req.profile.isKids });
  if (req.profile.isKids) { // sub-resources of a title (videos, credits…) are only served if the title itself is kid-safe
    const m = path.match(/^\/(movie|tv)\/(\d+)\//);
    if (m) filterKids(await tmdb(`/${m[1]}/${m[2]}`, { language }, 3600));
  }
  let data = await tmdb(path, params, ttlFor(path));
  if (req.profile.isKids) data = filterKids(data);
  res.set("Cache-Control", "private, max-age=60").send(data);
}));
module.exports = router;
