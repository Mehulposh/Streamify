import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Info, Play, Plus, Star } from "lucide-react";
import { img } from "../lib/api";
import { cx, titleOf, toTitle, typeOf, yearOf } from "../lib/utils";
import { useWatchlist } from "../context/WatchlistContext";
import { Badge, Button, Skeleton } from "./ui";

/** Rotating featured banner. `items` = TMDB results that have a backdrop. */
export default function Hero({ items, genres = {} }) {
  const nav = useNavigate(); const wl = useWatchlist();
  const [i, setI] = useState(0);
  const list = (items || []).filter((x) => x.backdrop_path).slice(0, 6);
  useEffect(() => { if (list.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % list.length), 9000); return () => clearInterval(t); }, [list.length]);
  if (!items) return <Skeleton className="mb-8 h-[56vh] min-h-[340px] w-full !rounded-3xl" />;
  if (!list.length) return null;
  return (
    <div className="relative mb-10 h-[58vh] min-h-[360px] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
      {list.map((m, k) => {
        const t = typeOf(m), saved = wl?.has(t, m.id);
        return (
          <div key={m.id} className={cx("absolute inset-0 transition-opacity duration-1000", k === i ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={k !== i}>
            <img src={img(m.backdrop_path, "w1280")} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0716]/95 via-[#0b0716]/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0716]/90 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 max-w-2xl p-6 text-white sm:p-10">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="rose">{t === "tv" ? "Series" : "Movie"}</Badge>
                {m.vote_average > 0 && <span className="flex items-center gap-1 text-sm font-semibold"><Star size={15} className="fill-amber-400 text-amber-400" />{m.vote_average.toFixed(1)}</span>}
                <span className="text-sm text-white/70">{yearOf(m)}</span>
                {(m.genre_ids || []).slice(0, 2).map((g) => genres[g] && <span key={g} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs backdrop-blur">{genres[g]}</span>)}
              </div>
              <h1 className="text-3xl font-black leading-tight tracking-tight drop-shadow sm:text-5xl">{titleOf(m)}</h1>
              <p className="mt-3 line-clamp-3 text-sm text-white/80 sm:text-base">{m.overview}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => nav(`/title/${t}/${m.id}?play=1`)}><Play size={18} className="fill-white" /> Play</Button>
                <Link to={`/title/${t}/${m.id}`}><Button size="lg" variant="ghost" className="!text-white"><Info size={18} /> More info</Button></Link>
                {wl && <Button size="lg" variant="ghost" className="!text-white" onClick={() => wl.toggle(toTitle(m, t))} aria-label="Toggle watchlist">{saved ? <Check size={18} /> : <Plus size={18} />}</Button>}
              </div>
            </div>
          </div>
        );
      })}
      {list.length > 1 && <div className="absolute bottom-4 right-5 flex gap-1.5">{list.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={cx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-white" : "w-1.5 bg-white/40")} />)}</div>}
    </div>
  );
}
