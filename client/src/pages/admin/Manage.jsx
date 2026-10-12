import { useState } from "react";
import { Check, Download, EyeOff, Megaphone, Plus, Trash2 } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Pagination, Select, Spinner, Tabs, Textarea } from "../../components/ui";
import { fmtDate, money, timeAgo } from "../../lib/utils";

export function Coupons() {
  const toast = useToast(); const { data, loading, reload } = useFetch(() => api.get("/admin/coupons"), []);
  const blank = { code: "", type: "percent", value: "", maxDiscount: "", maxUses: "", expiresAt: "" };
  const [f, setF] = useState(blank); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = async (e) => {
    e.preventDefault();
    try {
      const b = { code: f.code, type: f.type, value: Number(f.value) };
      if (f.maxDiscount) b.maxDiscount = Number(f.maxDiscount); if (f.maxUses) b.maxUses = Number(f.maxUses); if (f.expiresAt) b.expiresAt = new Date(f.expiresAt).toISOString();
      await api.post("/admin/coupons", b); toast("Coupon created"); setF(blank); reload(true);
    } catch (err) { toast(errMsg(err), "error"); }
  };
  const desc = (c) => (c.type === "percent" ? `${c.value}% off${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ""}` : c.type === "flat" ? `${money(c.value)} off` : `${c.value} free days (trial link)`);
  return (
    <>
      <PageHeader title="Coupons" subtitle="Percent / flat discounts and free-trial codes" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="h-fit"><form onSubmit={create} className="space-y-3"><h3 className="font-bold">New coupon</h3>
          <Field label="Code"><Input required pattern="[A-Za-z0-9_\-]{3,30}" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select value={f.type} onChange={set("type")}><option value="percent">Percent %</option><option value="flat">Flat ₹</option><option value="trial">Free days</option></Select></Field><Field label={f.type === "trial" ? "Days" : "Value"}><Input required type="number" min="1" max={f.type === "percent" ? 100 : undefined} value={f.value} onChange={set("value")} /></Field></div>
          {f.type === "percent" && <Field label="Max discount ₹"><Input type="number" min="1" value={f.maxDiscount} onChange={set("maxDiscount")} /></Field>}
          <div className="grid grid-cols-2 gap-3"><Field label="Max uses"><Input type="number" min="0" placeholder="0 = unlimited" value={f.maxUses} onChange={set("maxUses")} /></Field><Field label="Expires"><Input type="date" value={f.expiresAt} onChange={set("expiresAt")} /></Field></div>
          <Button className="w-full"><Plus size={16} /> Create</Button></form></Card>
        <div className="space-y-3 lg:col-span-2">{loading ? <Spinner /> : !data.coupons.length ? <Card><Empty title="No coupons yet" /></Card> : data.coupons.map((c) => (
          <Card key={c._id} className="flex flex-wrap items-center justify-between gap-3 !p-4"><div><p className="font-mono text-lg font-extrabold tracking-wider">{c.code}</p><p className="text-sm opacity-70">{desc(c)} · used {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""}{c.expiresAt ? ` · expires ${fmtDate(c.expiresAt)}` : ""}</p></div>
            <div className="flex items-center gap-2"><Badge tone={c.active ? "emerald" : "slate"}>{c.active ? "Active" : "Disabled"}</Badge><Button size="sm" variant="ghost" onClick={async () => { await api.patch(`/admin/coupons/${c._id}`, { active: !c.active }); reload(true); }}>{c.active ? "Disable" : "Enable"}</Button></div></Card>))}</div>
      </div>
    </>
  );
}

export function Reviews() {
  const toast = useToast(); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/reviews", { params: { status: status || undefined, page, limit: 15 } }), [status, page]);
  const act = async (fn, ok) => { try { await fn(); toast(ok); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <PageHeader title="Review moderation" subtitle="Held for profanity, auto-hidden after 3 reports, or reported by members" />
      <div className="mb-5"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: "", label: "Needs attention" }, { value: "pending", label: "Pending" }, { value: "hidden", label: "Hidden" }, { value: "reported", label: "Reported" }]} /></div>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.reviews.length ? <Card><Empty title="Queue is empty" text="Nothing needs moderation right now." /></Card> : (
        <div className="space-y-3">{data.reviews.map((r) => (
          <Card key={r.reviewId} className="space-y-3 !p-4">
            <div className="flex flex-wrap items-center gap-2"><b>{r.username}</b><Badge tone={r.status === "visible" ? "emerald" : r.status === "pending" ? "amber" : "rose"}>{r.status}</Badge><span className="text-xs opacity-60">{r.mediaType} #{r.movieId} · {timeAgo(r.datetime)}</span>{r.reports?.length > 0 && <Badge tone="rose">{r.reports.length} report(s)</Badge>}</div>
            <p className="whitespace-pre-wrap break-words text-sm">{r.review}</p>
            {r.reports?.length > 0 && <ul className="text-xs opacity-70">{r.reports.slice(0, 3).map((x, i) => <li key={i}>• {x.reason || "No reason given"}</li>)}</ul>}
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="success" onClick={() => act(() => api.post(`/admin/reviews/${r.reviewId}/status`, { status: "visible", clearReports: true }), "Approved")}><Check size={14} /> Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => api.post(`/admin/reviews/${r.reviewId}/status`, { status: "hidden" }), "Hidden")}><EyeOff size={14} /> Hide</Button>
              <Button size="sm" variant="ghost" className="!text-rose-500" onClick={() => window.confirm("Delete permanently?") && act(() => api.delete(`/review/deletereview/${r.reviewId}`), "Deleted")}><Trash2 size={14} /> Delete</Button></div>
          </Card>))}<Pagination pagination={data.pagination} onPage={setPage} /></div>)}
    </>
  );
}

export function Tools() {
  const toast = useToast(); const [f, setF] = useState({ title: "", body: "" }); const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); if (!window.confirm("Send this message to ALL users?")) return; setBusy(true); try { const { data } = await api.post("/admin/notifications/broadcast", f); toast(`Sent to ${data.sent} users`); setF({ title: "", body: "" }); } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Tools" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><form onSubmit={send} className="space-y-3"><h3 className="flex items-center gap-2 font-bold"><Megaphone size={18} className="text-fuchsia-500" /> Broadcast notification</h3>
          <Field label="Title"><Input required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Message"><Textarea required maxLength={500} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field><Button loading={busy}>Send to everyone</Button></form></Card>
        <Card className="space-y-3"><h3 className="flex items-center gap-2 font-bold"><Download size={18} className="text-fuchsia-500" /> Export CSV</h3><p className="text-sm opacity-70">Spreadsheet-safe files (formula injection is neutralised).</p>
          <div className="flex flex-wrap gap-2">{["users", "subscriptions", "payments"].map((t) => <a key={t} href={`/api/admin/export/${t}`}><Button variant="ghost" size="sm" type="button">{t[0].toUpperCase() + t.slice(1)}.csv</Button></a>)}</div></Card>
      </div>
    </>
  );
}
