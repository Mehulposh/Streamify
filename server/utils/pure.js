// Pure functions (no DB / network) so they can be unit-tested: node --test test/
const { AppError, round2 } = require("./helpers");
const { KIDS_BLOCKED_GENRES } = require("./constants");

const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5);
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const dayStr = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

/** Coupon maths: returns {base, discount, amount}. Only percent / flat coupons reduce a price. */
function priceWithCoupon(base, coupon) {
  let discount = 0;
  if (coupon?.type === "percent") discount = Math.min((base * coupon.value) / 100, coupon.maxDiscount || Infinity);
  else if (coupon?.type === "flat") discount = coupon.value;
  discount = Math.min(round2(discount), base);
  return { base, discount, amount: round2(base - discount) };
}

/** Review profanity filter (whole words). Matches go to moderation instead of being published. */
function containsProfanity(text, extra = []) {
  const words = ["fuck", "shit", "bitch", "asshole", "bastard", "cunt", "slut", "whore", ...extra].map((w) => w.replace(/[^a-z0-9]/gi, "")).filter(Boolean);
  return new RegExp(`\\b(${words.join("|")})\\b`, "i").test(String(text));
}

/** CSV with protection against spreadsheet formula injection (=,+,-,@). */
const csvCell = (v) => {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");

// ---------- TMDB proxy rules ----------
const TMDB_PATH = new RegExp("^/(?:" + [
  "configuration",
  "genre/(?:movie|tv)/list",
  "trending/(?:all|movie|tv)/(?:day|week)",
  "(?:movie|tv)/(?:popular|top_rated|upcoming|now_playing|on_the_air|airing_today)",
  "(?:movie|tv)/\\d{1,9}(?:/(?:credits|videos|similar|recommendations|watch/providers|images|external_ids|season/\\d{1,3}))?",
  "search/(?:multi|movie|tv|person)",
  "discover/(?:movie|tv)",
  "person/\\d{1,9}(?:/(?:combined_credits|movie_credits|tv_credits))?",
].join("|") + ")$");
const isAllowedTmdbPath = (p) => typeof p === "string" && p.length < 100 && TMDB_PATH.test(p);
const isGatedTmdbPath = (p) => /^\/(?:movie|tv)\/\d+\/videos$/.test(p); // trailers/playback need an active plan or trial
const SORTS = ["popularity.desc", "popularity.asc", "vote_average.desc", "vote_average.asc", "primary_release_date.desc", "primary_release_date.asc", "first_air_date.desc", "first_air_date.asc", "revenue.desc"];

/** Whitelists query parameters. Friendly names are mapped to TMDB's (dotted) names on the server. */
function buildTmdbParams(path, q = {}, { language = "en-US", kids = false } = {}) {
  const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
  const flt = (v, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
  const p = { language, include_adult: "false" };
  if (int(q.page, 1, 500)) p.page = int(q.page, 1, 500);
  if (typeof q.query === "string" && q.query.trim()) p.query = q.query.trim().slice(0, 100);
  if (path.startsWith("/discover/")) {
    const tv = path.endsWith("/tv");
    if (typeof q.genre === "string" && /^\d+(?:[,|]\d+)*$/.test(q.genre)) p.with_genres = q.genre;
    if (int(q.year, 1900, 2100)) p[tv ? "first_air_date_year" : "primary_release_year"] = int(q.year, 1900, 2100);
    if (flt(q.minRating, 0, 10) !== undefined) p["vote_average.gte"] = flt(q.minRating, 0, 10);
    if (flt(q.maxRating, 0, 10) !== undefined) p["vote_average.lte"] = flt(q.maxRating, 0, 10);
    if (typeof q.originalLanguage === "string" && /^[a-z]{2}$/.test(q.originalLanguage)) p.with_original_language = q.originalLanguage;
    if (SORTS.includes(q.sort)) p.sort_by = q.sort;
    if ((p.sort_by || "").startsWith("vote_average")) p["vote_count.gte"] = 100; // avoid 10/10 titles with 2 votes
    if (kids && !tv) { p.certification_country = "US"; p["certification.lte"] = "PG"; }
  }
  return p;
}

/** Removes adult / blocked-genre items from list results; refuses detail pages that are not kid-safe. */
function filterKids(data, blocked = KIDS_BLOCKED_GENRES) {
  const bad = (it) => it.adult === true || it.media_type === "person" || (it.genre_ids || []).some((g) => blocked.includes(g));
  if (Array.isArray(data?.results)) return { ...data, results: data.results.filter((it) => !bad(it)) };
  if (data && (data.adult === true || (Array.isArray(data.genres) && data.genres.some((g) => blocked.includes(g.id))))) {
    throw new AppError("This title is not available on a kids profile", 403, "KIDS_RESTRICTED");
  }
  return data;
}

/** signals: [{genre_ids:[…], weight}] -> top genres by accumulated weight */
function topGenres(signals, n = 3) {
  const m = new Map();
  for (const { genre_ids = [], weight = 1 } of signals) for (const g of genre_ids) m.set(g, (m.get(g) || 0) + weight);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, score]) => ({ id, score }));
}

module.exports = { addDays, addMonths, dayStr, priceWithCoupon, containsProfanity, csvCell, toCsv, isAllowedTmdbPath, isGatedTmdbPath, buildTmdbParams, filterKids, topGenres };
