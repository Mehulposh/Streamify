import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Eye, EyeOff, ListPlus, Lock, Play, Plus, Share2, Star } from "lucide-react";
import api, { errMsg, img, tmdb } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useWatchlist } from "../context/WatchlistContext";
import { useToast } from "../context/ToastContext";
import { Badge, Button, ErrorBox, Skeleton, Tabs } from "../components/ui";
import Row from "../components/Row";
import PosterCard from "../components/PosterCard";
import Player from "../components/Player";
import Reviews, { RatingBox } from "../components/Reviews";
import { AddToListModal, ShareModal } from "../components/Modals";
import { runtime, titleOf, yearOf } from "../lib/utils";

const pickVideo = (list) => { const yt = list.filter((v) => v.site === "YouTube"); return yt.find((v) => v.type === "Trailer" && v.official) || yt.find((v) => v.type === "Trailer") || yt.find((v) => v.type === "Teaser") || yt[0]; };

export default function Details() {
  const { mediaType, id } = useParams();
  if (!["movie", "tv"].includes(mediaType) || !/^\d+$/.test(id)) return <Navigate to="/" replace />;
  return <DetailsInner key={`${mediaType}-${id}`} type={mediaType} id={Number(id)} />;
}

function DetailsInner({ type, id }) {
  const toast = useToast(); const wl = useWatchlist(); const [sp] = useSearchParams();
  const d = useFetch(() => tmdb(`/${type}/${id}`), [type, id]);
  const credits = useFetch(() => tmdb(`/${type}/${id}/credits`), [type, id]);
  const similar = useFetch(() => tmdb(`/${type}/${id}/similar`), [type, id]);
  const recs = useFetch(() => tmdb(`/${type}/${id}/recommendations`), [type, id]);
  const prov = useFetch(() => tmdb(`/${type}/${id}/watch/providers`), [type, id]);
  const [tab, setTab] = useState("reviews"); const [player, setPlayer] = useState(null); const [playing, setPlaying] = useState(false);
  const [listOpen, setListOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false); const auto = useRef(false);

  const m = d.data;
  const item = m && { id, mediaType: type, title: titleOf(m), poster_path: m.poster_path, backdrop_path: m.backdrop_path, genre_ids: (m.genres || []).map((g) => g.id), release_date: m.release_date || m.first_air_date || "", vote_average: m.vote_average || 0 };
  const saved = wl?.find(type, id);

  const play = async () => {
    setPlaying(true);
    try {
      const { data: start } = await api.post("/history/playback/start", { tmdbId: id, mediaType: type }); // paywall + daily limit are enforced here
      const v = pickVideo((await tmdb(`/${type}/${id}/videos`)).data.results || []);
      if (!v) return toast("No trailer is available for this title yet", "info");
      const mins = m?.runtime || m?.episode_run_time?.[0] || 0;
      setPlayer({ key: v.key, start: start.resume, trialRemaining: start.reason === "trial" ? start.trialRemainingSeconds : null, duration: mins * 60 });
    } catch (e) { if (e.response?.status !== 402) toast(e.response?.data?.code === "DAILY_LIMIT" ? "Daily watch limit reached for this profile" : errMsg(e), "error"); } // 402 opens the paywall by itself
    finally { setPlaying(false); }
  };
  useEffect(() => { if (m && sp.get("play") === "1" && !auto.current) { auto.current = true; play(); } }, [m]); // eslint-disable-line

  if (d.loading) return <Skeleton className="h-[60vh] w-full !rounded-3xl" />;
  if (d.error) return <ErrorBox message={d.error} />;
  const cast = (credits.data?.cast || []).slice(0, 14);
  const region = prov.data?.results?.IN || prov.data?.results?.US;
  const meta = [yearOf(m), runtime(m), type === "tv" && m.number_of_seasons ? `${m.number_of_seasons} season${m.number_of_seasons > 1 ? "s" : ""}` : ""].filter(Boolean);

  return (
    <div className="animate-fade">
      <div className="relative -mx-3 -mt-20 mb-8 overflow-hidden sm:-mx-5 sm:-mt-24 sm:rounded-b-[2.5rem]">
        {m.backdrop_path && <img src={img(m.backdrop_path, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0716] via-[#0b0716]/70 to-[#0b0716]/30" />
        <div className="relative mx-auto flex max-w-[1600px] flex-col gap-6 px-4 pb-10 pt-28 text-white sm:flex-row sm:px-8 sm:pt-36">
          <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-64">{m.poster_path ? <img src={img(m.poster_path, "w500")} alt={titleOf(m)} className="w-full rounded-2xl shadow-2xl ring-1 ring-white/20" /> : <div className="glass aspect-[2/3] rounded-2xl" />}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{titleOf(m)}</h1>
            {m.tagline && <p className="mt-2 italic text-white/70">{m.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {m.vote_average > 0 && <span className="flex items-center gap-1 font-bold"><Star size={16} className="fill-amber-400 text-amber-400" />{m.vote_average.toFixed(1)} <span className="font-normal text-white/60">TMDB</span></span>}
              {meta.map((x) => <span key={x} className="text-white/80">{x}</span>)}
              {(m.genres || []).map((g) => <Badge key={g.id} tone="slate" className="!bg-white/15 !text-white">{g.name}</Badge>)}
            </div>
            <p className="mt-5 max-w-3xl text-white/85">{m.overview || "No description available."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" loading={playing} onClick={play}><Play size={18} className="fill-white" /> Play trailer</Button>
              <Button size="lg" variant="ghost" className="!text-white" onClick={() => wl.toggle(item)}>{saved ? <Check size={18} /> : <Plus size={18} />} {saved ? "In watchlist" : "Watchlist"}</Button>
              {saved && <Button size="lg" variant="ghost" className="!text-white" onClick={() => wl.setWatched(saved, !saved.watched)}>{saved.watched ? <EyeOff size={18} /> : <Eye size={18} />} {saved.watched ? "Mark unwatched" : "Mark watched"}</Button>}
              <Button size="lg" variant="ghost" className="!text-white" onClick={() => setListOpen(true)}><ListPlus size={18} /> Add to list</Button>
              <Button size="lg" variant="ghost" className="!text-white" onClick={() => setShareOpen(true)}><Share2 size={18} /> Share</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <RatingBox item={item} />
        {region && (region.flatrate || region.rent || region.buy) && (
          <section><h2 className="mb-3 text-lg font-extrabold">Where to watch</h2>
            <div className="flex flex-wrap gap-6">{[["flatrate", "Stream"], ["rent", "Rent"], ["buy", "Buy"]].map(([k, l]) => region[k]?.length ? (
              <div key={k}><p className="label">{l}</p><div className="flex gap-2">{region[k].slice(0, 6).map((p) => <img key={p.provider_id} src={img(p.logo_path, "w92")} alt={p.provider_name} title={p.provider_name} className="h-11 w-11 rounded-xl shadow ring-1 ring-black/10" />)}</div></div>) : null)}</div></section>)}
        <Row title="Cast" items={cast} loading={credits.loading} renderItem={(c) => (
          <Link key={c.id} to={`/person/${c.id}`} className="group w-28 shrink-0 snap-start text-center sm:w-32">
            {c.profile_path ? <img src={img(c.profile_path, "w185")} alt={c.name} loading="lazy" className="mx-auto h-28 w-28 rounded-full object-cover shadow-lg ring-2 ring-transparent transition group-hover:ring-fuchsia-400 sm:h-32 sm:w-32" /> : <div className="glass mx-auto h-28 w-28 rounded-full sm:h-32 sm:w-32" />}
            <p className="mt-2 line-clamp-1 text-sm font-semibold">{c.name}</p><p className="line-clamp-1 text-xs opacity-60">{c.character}</p></Link>)} />
        <div><Tabs value={tab} onChange={setTab} tabs={[{ value: "reviews", label: "Reviews" }, { value: "similar", label: "More like this" }, { value: "recs", label: "Recommended" }]} />
          <div className="mt-5">{tab === "reviews" ? <Reviews item={item} /> : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">{((tab === "similar" ? similar : recs).data?.results || []).slice(0, 16).map((x) => <PosterCardLazy key={x.id} x={x} type={type} />)}</div>)}</div></div>
      </div>
      {player && <Player item={item} videoKey={player.key} start={player.start} durationSeconds={player.duration} trialRemaining={player.trialRemaining} onClose={() => setPlayer(null)} />}
      <AddToListModal open={listOpen} onClose={() => setListOpen(false)} item={item} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} item={item} />
    </div>
  );
}
const PosterCardLazy = ({ x, type }) => <PosterCard item={x} type={x.media_type || type} className="w-full" />;
