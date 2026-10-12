import { useState } from "react";
import { Flag, Pencil, ThumbsUp, Trash2 } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button, Card, Empty, Pagination, Spinner, StarInput, Stars, Tabs, Textarea } from "./ui";
import { cx, timeAgo } from "../lib/utils";

/** Community star rating for a title (1-5) + my own rating. */
export function RatingBox({ item }) {
  const toast = useToast();
  const { data, setData } = useFetch(() => api.get(`/ratings/summary/${item.mediaType}/${item.id}`), [item.id, item.mediaType]);
  const rate = async (stars) => {
    try {
      const { data: d } = await api.put("/ratings", { tmdbId: item.id, mediaType: item.mediaType, stars, title: item.title, poster_path: item.poster_path || null, genre_ids: item.genre_ids || [] });
      setData({ status: true, mine: d.mine, average: d.average, count: d.count }); toast("Thanks for rating!");
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const clear = async () => { try { await api.delete(`/ratings/${item.mediaType}/${item.id}`); setData((x) => ({ ...x, mine: 0 })); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <div className="glass flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl p-4">
      <div><p className="label !mb-1">Community rating</p>{data?.count ? <Stars value={data.average} count={data.count} size={18} /> : <p className="text-sm opacity-70">Be the first to rate</p>}</div>
      <div><p className="label !mb-1">Your rating {data?.mine > 0 && <button className="ml-2 normal-case text-fuchsia-500 underline" onClick={clear}>clear</button>}</p><StarInput value={data?.mine || 0} onChange={rate} /></div>
    </div>
  );
}

/** Reviews: helpful votes, report, edit/delete own, sort, pagination, moderation notice. */
export default function Reviews({ item }) {
  const { user } = useAuth(); const toast = useToast();
  const [sort, setSort] = useState("new"); const [page, setPage] = useState(1);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState(null);
  const { data, loading, reload } = useFetch(() => api.get(`/review/getreviews/${item.id}`, { params: { mediaType: item.mediaType, sort: sort === "helpful" ? "helpful" : undefined, page, limit: 6 } }), [item.id, item.mediaType, sort, page]);
  const mine = data?.reviews?.find((r) => r.userId === user._id);

  const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast(r?.data?.msg || ok, r?.data?.moderation ? "info" : "success"); reload(true); return r; } catch (e) { toast(errMsg(e), e.response?.status === 409 ? "info" : "error"); } };
  const add = async (e) => { e.preventDefault(); setBusy(true); const r = await run(() => api.post("/review/addreview", { movieId: item.id, mediaType: item.mediaType, review: text }), "Review posted"); if (r) setText(""); setBusy(false); };
  const save = async () => { const r = await run(() => api.put("/review/editreview", { reviewId: editing.id, review: editing.text }), "Review updated"); if (r) setEditing(null); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold">Reviews {data?.pagination?.total ? `(${data.pagination.total})` : ""}</h3>
        <Tabs value={sort} onChange={(v) => { setSort(v); setPage(1); }} tabs={[{ value: "new", label: "Newest" }, { value: "helpful", label: "Most helpful" }]} />
      </div>
      {!mine && (
        <form onSubmit={add} className="glass space-y-3 rounded-2xl p-4">
          <Textarea required maxLength={2000} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`What did you think of ${item.title}?`} />
          <div className="flex items-center justify-between"><span className="text-xs opacity-60">{text.length}/2000 · be kind, reviews with offensive words wait for moderation</span><Button loading={busy}>Post review</Button></div>
        </form>)}
      {loading ? <Spinner className="!py-8" /> : !data.reviews.length ? <Card><Empty title="No reviews yet" text="Share your thoughts to help others decide." /></Card> : (
        <div className="space-y-3">
          {data.reviews.map((r) => {
            const own = r.userId === user._id;
            return (
              <Card key={r.reviewId} className="!p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-sm font-bold text-white">{r.username[0].toUpperCase()}</div>
                    <div><p className="text-sm font-bold">{r.username}{own && <span className="ml-1.5 text-xs font-semibold text-fuchsia-500">you</span>}</p><p className="text-xs opacity-60">{timeAgo(r.datetime)}</p></div></div>
                  <div className="flex gap-1">
                    {own && <button aria-label="Edit review" onClick={() => setEditing({ id: r.reviewId, text: r.review })} className="rounded-lg p-2 hover:bg-fuchsia-500/10"><Pencil size={15} /></button>}
                    {(own || user.role === "admin") && <button aria-label="Delete review" onClick={() => window.confirm("Delete this review?") && run(() => api.delete(`/review/deletereview/${r.reviewId}`), "Review deleted")} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>}
                  </div>
                </div>
                {editing?.id === r.reviewId ? (
                  <div className="mt-3 space-y-2"><Textarea maxLength={2000} rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                    <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" onClick={save}>Save</Button></div></div>
                ) : <p className="mt-3 whitespace-pre-wrap break-words text-sm">{r.review}</p>}
                {!own && (
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <button onClick={() => run(() => api.post(`/review/${r.reviewId}/helpful`))} className={cx("flex items-center gap-1.5 font-semibold transition", r.iMarkedHelpful ? "text-fuchsia-500" : "opacity-70 hover:opacity-100")}><ThumbsUp size={14} className={r.iMarkedHelpful ? "fill-fuchsia-500" : ""} /> Helpful ({r.helpfulCount})</button>
                    <button onClick={() => run(() => api.post(`/review/${r.reviewId}/report`, {}), "Reported. A moderator will take a look.")} className="flex items-center gap-1.5 opacity-60 hover:opacity-100"><Flag size={13} /> Report</button>
                  </div>)}
                {own && <p className="mt-2 text-xs opacity-60">{r.helpfulCount} found this helpful</p>}
              </Card>);
          })}
          <Pagination pagination={data.pagination} onPage={setPage} />
        </div>)}
    </div>
  );
}
