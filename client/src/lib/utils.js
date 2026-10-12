export const cx = (...a) => a.filter(Boolean).join(" ");
export const money = (n) => (n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
export const fmtDate = (d, time = false) => (!d ? "—" : new Date(d).toLocaleString("en-IN", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }));
export const timeAgo = (d) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  for (const [l, v] of [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]]) if (s >= v) return `${Math.floor(s / v)}${l} ago`;
  return "just now";
};
export const titleOf = (x) => x?.title || x?.name || "Untitled";
export const yearOf = (x) => (x?.release_date || x?.first_air_date || "").slice(0, 4);
export const typeOf = (x, fallback = "movie") => (x?.media_type === "tv" || (!x?.media_type && x?.name && !x?.title) ? "tv" : x?.media_type === "movie" ? "movie" : fallback);
export const runtime = (m) => { const r = m?.runtime || m?.episode_run_time?.[0]; return r ? `${Math.floor(r / 60) ? Math.floor(r / 60) + "h " : ""}${r % 60}m` : ""; };
export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
export const AVATARS = [["avatar1", "🦊", "from-rose-500 to-orange-400"], ["avatar2", "🐼", "from-sky-500 to-indigo-500"], ["avatar3", "🦄", "from-fuchsia-500 to-violet-500"], ["avatar4", "🐯", "from-amber-500 to-red-500"],
  ["avatar5", "🐸", "from-emerald-500 to-teal-400"], ["avatar6", "🤖", "from-slate-500 to-cyan-500"], ["avatar7", "👽", "from-lime-500 to-emerald-600"], ["avatar8", "🐙", "from-pink-500 to-purple-600"]];
export const avatarOf = (id) => AVATARS.find((a) => a[0] === id) || AVATARS[0];
export const LANGS = [["en-US", "English"], ["hi-IN", "हिन्दी"], ["ta-IN", "தமிழ்"], ["te-IN", "తెలుగు"], ["es-ES", "Español"], ["fr-FR", "Français"]];
export const toTitle = (x, type) => ({ id: x.id, mediaType: type || typeOf(x), title: titleOf(x), poster_path: x.poster_path || null, genre_ids: x.genre_ids || (x.genres || []).map((g) => g.id), release_date: x.release_date || x.first_air_date || "", vote_average: x.vote_average || 0 });
export const statusLabel = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
