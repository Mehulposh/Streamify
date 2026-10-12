import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { tmdb, errMsg } from "../lib/api";
import { genreList } from "../lib/genres";
import { Button, Card, Empty, Input, PageHeader, Select, Skeleton } from "../components/ui";
import PosterCard from "../components/PosterCard";
import { LANGS, cx } from "../lib/utils";

const SORTS = [["popularity.desc", "Most popular"], ["vote_average.desc", "Top rated"], ["primary_release_date.desc", "Newest"], ["primary_release_date.asc", "Oldest"]];
const TV_SORTS = [["popularity.desc", "Most popular"], ["vote_average.desc", "Top rated"], ["first_air_date.desc", "Newest"], ["first_air_date.asc", "Oldest"]];
const ORIG = [["", "Any language"], ["en", "English"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"], ["ko", "Korean"], ["ja", "Japanese"], ["es", "Spanish"], ["fr", "French"]];

/** Explore: genre chips + year / rating / language / sort, "load more" pagination. type = "movie" | "tv" */
export default function Browse({ type }) {
  const [genres, setGenres] = useState([]); const [sel, setSel] = useState([]);
  const [f, setF] = useState({ sort: "popularity.desc", year: "", minRating: "", originalLanguage: "" });
  const [items, setItems] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [loading, setLoading] = useState(true); const [err, setErr] = useState("");

  useEffect(() => { setSel([]); setF({ sort: "popularity.desc", year: "", minRating: "", originalLanguage: "" }); genreList(type).then(setGenres).catch(() => {}); }, [type]);
  useEffect(() => { setItems([]); setPage(1); }, [type, sel, f]);
  useEffect(() => {
    let live = true; setLoading(true); setErr("");
    tmdb(`/discover/${type}`, { genre: sel.join(",") || undefined, year: f.year || undefined, minRating: f.minRating || undefined, sort: f.sort, originalLanguage: f.originalLanguage || undefined, page })
      .then((r) => { if (!live) return; setItems((a) => (page === 1 ? r.data.results : [...a, ...r.data.results.filter((n) => !a.some((x) => x.id === n.id))])); setPages(Math.min(r.data.total_pages || 1, 500)); })
      .catch((e) => live && setErr(errMsg(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [type, sel, f, page]);

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <PageHeader title={type === "tv" ? "Series" : "Movies"} subtitle="Filter by genre, year, rating and language" />
      <Card className="mb-6 space-y-4 !p-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {genres.map((g) => <button key={g.id} onClick={() => toggle(g.id)} className={cx("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", sel.includes(g.id) ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300" : "border-slate-300/50 opacity-80 hover:opacity-100 dark:border-white/10")}>{g.name}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} aria-label="Sort">{(type === "tv" ? TV_SORTS : SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Input type="number" min="1900" max="2100" placeholder="Year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
          <Select value={f.minRating} onChange={(e) => setF({ ...f, minRating: e.target.value })} aria-label="Minimum rating"><option value="">Any rating</option>{[5, 6, 7, 8].map((r) => <option key={r} value={r}>{r}+ stars</option>)}</Select>
          <Select value={f.originalLanguage} onChange={(e) => setF({ ...f, originalLanguage: e.target.value })} aria-label="Original language">{ORIG.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </div>
      </Card>
      {err && <p className="mb-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{err}</p>}
      {!loading && !items.length && !err ? <Card><Empty icon={Film} title="Nothing matches these filters" text="Try removing a genre or lowering the minimum rating." /></Card> : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {items.map((m) => <PosterCard key={m.id} item={m} type={type} className="w-full" />)}
          {loading && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3]" />)}
        </div>)}
      {!loading && page < pages && <div className="mt-8 text-center"><Button variant="ghost" onClick={() => setPage(page + 1)}>Load more</Button></div>}
    </>
  );
}
