import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, User } from "lucide-react";
import { img, tmdb, errMsg } from "../lib/api";
import { Button, Card, Empty, PageHeader, Skeleton } from "../components/ui";
import PosterCard from "../components/PosterCard";

export default function Search() {
  const [sp] = useSearchParams(); const q = (sp.get("q") || "").trim();
  const [items, setItems] = useState([]); const [people, setPeople] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { setItems([]); setPeople([]); setPage(1); }, [q]);
  useEffect(() => {
    if (!q) return; let live = true; setLoading(true); setErr("");
    tmdb("/search/multi", { query: q, page }).then((r) => {
      if (!live) return;
      const res = r.data.results;
      setItems((a) => [...(page === 1 ? [] : a), ...res.filter((x) => ["movie", "tv"].includes(x.media_type))]);
      if (page === 1) setPeople(res.filter((x) => x.media_type === "person").slice(0, 8));
      setPages(Math.min(r.data.total_pages || 1, 50));
    }).catch((e) => live && setErr(errMsg(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [q, page]);

  if (!q) return <Card><Empty icon={SearchIcon} title="Search for a movie, series or person" text="Use the search bar at the top." /></Card>;
  return (
    <>
      <PageHeader title={`Results for “${q}”`} />
      {err && <p className="mb-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{err}</p>}
      {people.length > 0 && (
        <div className="mb-8"><p className="label">People</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{people.map((p) => (
            <Link key={p.id} to={`/person/${p.id}`} className="glass flex w-56 shrink-0 items-center gap-3 rounded-2xl p-3 transition hover:scale-[1.03]">
              {p.profile_path ? <img src={img(p.profile_path, "w185")} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-full bg-fuchsia-500/20"><User /></div>}
              <div className="min-w-0"><p className="truncate font-bold">{p.name}</p><p className="truncate text-xs opacity-60">{p.known_for_department}</p></div></Link>))}</div></div>)}
      {!loading && !items.length && !err ? <Card><Empty icon={SearchIcon} title="No titles found" text="Check the spelling or try another keyword." /></Card> : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {items.map((m) => <PosterCard key={`${m.media_type}-${m.id}`} item={m} type={m.media_type} className="w-full" />)}
          {loading && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3]" />)}
        </div>)}
      {!loading && page < pages && <div className="mt-8 text-center"><Button variant="ghost" onClick={() => setPage(page + 1)}>Load more</Button></div>}
    </>
  );
}
