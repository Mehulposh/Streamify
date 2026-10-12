import { useState } from "react";
import { Bookmark, Eye, EyeOff, Trash2 } from "lucide-react";
import { useWatchlist } from "../context/WatchlistContext";
import { Card, Empty, PageHeader, Select, Skeleton, Tabs } from "../components/ui";
import PosterCard from "../components/PosterCard";
import { Link } from "react-router-dom";

export default function Watchlist() {
  const wl = useWatchlist(); const [tab, setTab] = useState("all"); const [type, setType] = useState(""); const [sort, setSort] = useState("added");
  if (!wl.ready) return <div className="grid grid-cols-3 gap-4 md:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3]" />)}</div>;
  let list = wl.items.filter((m) => (tab === "all" ? true : tab === "watched" ? m.watched : !m.watched) && (!type || m.mediaType === type));
  list = [...list].sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : sort === "rating" ? b.vote_average - a.vote_average : new Date(b.createdAt) - new Date(a.createdAt)));
  const counts = { all: wl.items.length, unwatched: wl.items.filter((m) => !m.watched).length, watched: wl.items.filter((m) => m.watched).length };
  return (
    <>
      <PageHeader title="My watchlist" subtitle="Saved for this profile. We remind you when a saved title is about to release." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: "all", label: `All (${counts.all})` }, { value: "unwatched", label: `To watch (${counts.unwatched})` }, { value: "watched", label: `Watched (${counts.watched})` }]} />
        <Select className="!w-36" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">Movies & series</option><option value="movie">Movies</option><option value="tv">Series</option></Select>
        <Select className="!w-40" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="added">Recently added</option><option value="title">Title A-Z</option><option value="rating">Highest rated</option></Select>
      </div>
      {!list.length ? <Card><Empty icon={Bookmark} title="Nothing here yet" text="Tap + on any poster to save it." action={<Link to="/movies" className="mt-3 font-semibold text-fuchsia-500">Browse movies</Link>} /></Card> : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {list.map((m) => (
            <div key={m.saveId}>
              <PosterCard item={m} type={m.mediaType} className="w-full" />
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={() => wl.setWatched(m, !m.watched)} className="glass flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold" title={m.watched ? "Mark unwatched" : "Mark watched"}>{m.watched ? <EyeOff size={13} /> : <Eye size={13} />}{m.watched ? "Unwatch" : "Watched"}</button>
                <button onClick={() => wl.toggle(m)} aria-label="Remove" className="glass grid h-7 w-8 place-items-center rounded-lg text-rose-500"><Trash2 size={13} /></button>
              </div>
            </div>))}
        </div>)}
    </>
  );
}
