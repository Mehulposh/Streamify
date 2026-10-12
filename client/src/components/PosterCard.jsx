import { Link } from "react-router-dom";
import { Check, Plus, Star } from "lucide-react";
import { img } from "../lib/api";
import { cx, titleOf, toTitle, typeOf, yearOf } from "../lib/utils";
import { useWatchlist } from "../context/WatchlistContext";

/** Poster tile. Hover shows a glass info panel + quick "add to watchlist". `progress` (0-100) draws a resume bar. */
export default function PosterCard({ item, type, progress, className, to }) {
  const wl = useWatchlist();
  const t = type || typeOf(item);
  const saved = wl?.has(t, item.id ?? item.tmdbId);
  const id = item.id ?? item.tmdbId;
  const title = titleOf(item);
  return (
    <Link to={to || `/title/${t}/${id}`} className={cx("group relative block shrink-0 snap-start", className || "w-[140px] sm:w-[170px]")}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-slate-300/40 shadow-lg ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:shadow-fuchsia-500/30 dark:bg-white/5 dark:ring-white/10">
        {item.poster_path ? <img src={img(item.poster_path, "w342")} alt={title} loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center bg-gradient-to-br from-fuchsia-500/30 to-violet-600/30 p-3 text-center text-sm font-bold">{title}</div>}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-8 text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-2 text-xs font-bold leading-tight">{title}</p>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-white/80">
            {item.vote_average > 0 && <span className="flex items-center gap-0.5"><Star size={11} className="fill-amber-400 text-amber-400" />{item.vote_average.toFixed(1)}</span>}
            <span>{yearOf(item) || (item.release_date || "").slice(0, 4)}</span>
          </p>
        </div>
        {wl && (
          <button aria-label={saved ? "Remove from watchlist" : "Add to watchlist"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); wl.toggle(toTitle(item, t)); }}
            className={cx("glass absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full opacity-0 transition group-hover:opacity-100 focus:opacity-100", saved && "!bg-fuchsia-500 text-white opacity-100")}>
            {saved ? <Check size={15} /> : <Plus size={15} />}
          </button>)}
        {progress > 0 && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40"><div className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-500" style={{ width: `${progress}%` }} /></div>}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold">{title}</p>
    </Link>
  );
}
