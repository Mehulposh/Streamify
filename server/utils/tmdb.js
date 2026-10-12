const env = require("../config/env");
const { AppError } = require("./helpers");

const BASE = "https://api.themoviedb.org/3";
const cache = new Map(); // key -> { exp, data }   (tiny in-memory cache; swap for Redis if you scale out)
const MAX = 500;

async function tmdb(path, params = {}, ttlSec = 300) {
  if (!env.tmdbToken) throw new AppError("TMDB is not configured on the server (set TMDB_TOKEN)", 503);
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const key = `${path}?${qs}`, hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  let r;
  try {
    r = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, { headers: { Authorization: `Bearer ${env.tmdbToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch { throw new AppError("Could not reach TMDB", 502); }
  if (r.status === 404) throw new AppError("Not found", 404);
  if (!r.ok) throw new AppError("TMDB error", 502);
  const data = await r.json();
  cache.set(key, { exp: Date.now() + ttlSec * 1000, data });
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return data;
}
module.exports = { tmdb };
