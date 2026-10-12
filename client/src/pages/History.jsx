import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, History as HistoryIcon, Star, Trash2 } from "lucide-react";
import api, { errMsg, img } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useProfile } from "../context/ProfileContext";
import { useToast } from "../context/ToastContext";
import { Button, Card, Empty, PageHeader, Pagination, Spinner, Stars, Tabs } from "../components/ui";
import { mmss, timeAgo } from "../lib/utils";

function Usage() {
  const { active } = useProfile();
  const { data } = useFetch(() => api.get(`/profiles/${active._id}/watch-time`), [active._id]);
  if (!data) return null;
  const used = Math.round(data.usedSeconds / 60);
  return <Card className="mb-6 flex flex-wrap items-center gap-4 !p-4"><Clock className="text-fuchsia-500" /><div className="flex-1"><p className="font-bold">Watched today: {used} min</p>
    {data.limitMinutes ? <div className="mt-2"><div className="h-2 rounded-full bg-slate-500/20"><div className="h-2 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500" style={{ width: `${Math.min(100, (data.usedSeconds / (data.limitMinutes * 60)) * 100)}%` }} /></div><p className="mt-1 text-xs opacity-60">Daily limit {data.limitMinutes} min · {Math.round(data.remainingSeconds / 60)} min left</p></div> : <p className="text-xs opacity-60">No daily limit on this profile</p>}</div></Card>;
}

function HistoryTab() {
  const toast = useToast(); const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(() => api.get("/history", { params: { page, limit: 12 } }), [page]);
  const del = async (h) => { try { await api.delete(`/history/${h.mediaType}/${h.tmdbId}`); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  const clear = async () => { if (!window.confirm("Clear your whole watch history?")) return; try { await api.delete("/history"); toast("History cleared"); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  if (loading) return <Spinner />;
  if (!data.items.length) return <Card><Empty icon={HistoryIcon} title="No watch history yet" text="Titles you play show up here and in Continue watching." /></Card>;
  return (
    <>
      <div className="mb-3 text-right"><Button variant="ghost" size="sm" onClick={clear}><Trash2 size={14} /> Clear all</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.items.map((h) => { const pct = h.durationSeconds ? Math.min(100, Math.round((h.progressSeconds / h.durationSeconds) * 100)) : 0; return (
          <Card key={h._id} className="flex gap-4 !p-3">
            <Link to={`/title/${h.mediaType}/${h.tmdbId}`} className="shrink-0">{h.poster_path ? <img src={img(h.poster_path, "w154")} alt="" className="h-28 w-[75px] rounded-xl object-cover" /> : <div className="h-28 w-[75px] rounded-xl bg-fuchsia-500/20" />}</Link>
            <div className="min-w-0 flex-1"><Link to={`/title/${h.mediaType}/${h.tmdbId}`} className="line-clamp-1 font-bold hover:text-fuchsia-500">{h.title}</Link>
              <p className="text-xs opacity-60">{h.mediaType === "tv" ? "Series" : "Movie"} · {timeAgo(h.updatedAt)}</p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-500/20"><div className="h-1.5 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500" style={{ width: `${h.completed ? 100 : pct}%` }} /></div>
              <p className="mt-1 text-xs opacity-60">{h.completed ? "Finished" : `${mmss(h.progressSeconds)} watched`}</p></div>
            <button onClick={() => del(h)} aria-label="Remove from history" className="self-start rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
          </Card>); })}
      </div>
      <Pagination pagination={data.pagination} onPage={setPage} />
    </>
  );
}

function RatingsTab() {
  const toast = useToast(); const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(() => api.get("/ratings/mine", { params: { page, limit: 12 } }), [page]);
  if (loading) return <Spinner />;
  if (!data.items.length) return <Card><Empty icon={Star} title="You have not rated anything" text="Open a title and tap the stars." /></Card>;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">{data.items.map((r) => (
        <Card key={r._id} className="flex items-center gap-4 !p-3">
          <Link to={`/title/${r.mediaType}/${r.tmdbId}`}>{r.poster_path ? <img src={img(r.poster_path, "w154")} alt="" className="h-24 w-16 rounded-xl object-cover" /> : <div className="h-24 w-16 rounded-xl bg-fuchsia-500/20" />}</Link>
          <div className="min-w-0 flex-1"><Link to={`/title/${r.mediaType}/${r.tmdbId}`} className="line-clamp-1 font-bold hover:text-fuchsia-500">{r.title || "Untitled"}</Link><Stars value={r.stars} size={17} /><p className="mt-1 text-xs opacity-60">{timeAgo(r.updatedAt)}</p></div>
          <button aria-label="Remove rating" onClick={async () => { try { await api.delete(`/ratings/${r.mediaType}/${r.tmdbId}`); reload(true); } catch (e) { toast(errMsg(e), "error"); } }} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
        </Card>))}</div>
      <Pagination pagination={data.pagination} onPage={setPage} />
    </>
  );
}

export default function History() {
  const [tab, setTab] = useState("history");
  return (
    <>
      <PageHeader title="History & ratings" subtitle="Everything is per profile" />
      <Usage />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[{ value: "history", label: "Watch history" }, { value: "ratings", label: "My ratings" }]} /></div>
      {tab === "history" ? <HistoryTab /> : <RatingsTab />}
    </>
  );
}
