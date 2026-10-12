import { useState } from "react";
import { Ban, Gift, Trash2 } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Pagination, Select, Spinner, Tabs } from "../../components/ui";
import { fmtDate, money } from "../../lib/utils";

const Table = ({ head, children }) => <Card className="overflow-x-auto !p-0"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide opacity-60"><tr>{head.map((h, i) => <th key={i} className="p-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-500/10">{children}</tbody></table></Card>;

export function Users() {
  const toast = useToast(); const [q, setQ] = useState(""); const [role, setRole] = useState(""); const [page, setPage] = useState(1); const dq = useDebounced(q);
  const [grant, setGrant] = useState(null); const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/users", { params: { q: dq || undefined, role: role || undefined, page, limit: 20 } }), [dq, role, page]);
  const act = async (fn, ok) => { try { await fn(); toast(ok); setGrant(null); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <PageHeader title="Users" />
      <Card className="mb-5 grid gap-3 !p-4 sm:grid-cols-3"><Input placeholder="Search username or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="user">Members</option><option value="admin">Admins</option></Select></Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.users.length ? <Card><Empty title="No users found" /></Card> : (
        <Table head={["User", "Role", "Joined", "Status", ""]}>{data.users.map((u) => (
          <tr key={u._id}><td className="p-4"><p className="font-semibold">{u.username}</p><p className="text-xs opacity-60">{u.email}</p></td><td><Badge tone={u.role === "admin" ? "violet" : "slate"}>{u.role}</Badge></td><td className="opacity-70">{fmtDate(u.createdAt)}</td>
            <td>{u.isBlocked ? <Badge tone="rose">Blocked</Badge> : <Badge tone="emerald">Active</Badge>}</td>
            <td className="pr-4"><div className="flex justify-end gap-2">{u.role !== "admin" && (<>
              <Button size="sm" variant="ghost" title="Gift free days" onClick={() => setGrant(u)}><Gift size={14} /></Button>
              {u.isBlocked ? <Button size="sm" variant="soft" onClick={() => act(() => api.post(`/admin/users/${u._id}/block`, { blocked: false }), "Unblocked")}>Unblock</Button>
                : <Button size="sm" variant="ghost" title="Block" onClick={() => window.confirm(`Block ${u.username}?`) && act(() => api.post(`/admin/users/${u._id}/block`, { blocked: true }), "User blocked")}><Ban size={14} /></Button>}
              <Button size="sm" variant="ghost" className="!text-rose-500" title="Delete user and data" onClick={() => window.confirm(`Delete ${u.username} and all their data?`) && act(() => api.delete(`/admin/users/${u._id}`), "User deleted")}><Trash2 size={14} /></Button></>)}</div></td></tr>))}</Table>)}
      <Pagination pagination={data?.pagination} onPage={setPage} />
      <Modal open={!!grant} onClose={() => setGrant(null)} title={`Gift free days to ${grant?.username}`}>
        <div className="space-y-4"><Input type="number" min="1" max="3650" value={days} onChange={(e) => setDays(e.target.value)} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setGrant(null)}>Cancel</Button><Button onClick={() => act(() => api.post(`/admin/users/${grant._id}/grant`, { days: Number(days) }), "Days added")}>Add {days} days</Button></div></div>
      </Modal>
    </>
  );
}

export function Subscriptions() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1); const dq = useDebounced(q);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/subscriptions", { params: { q: dq || undefined, status: status || undefined, page, limit: 20 } }), [dq, status, page]);
  return (
    <>
      <PageHeader title="Subscriptions" />
      <Card className="mb-5 grid gap-3 !p-4 sm:grid-cols-3"><Input placeholder="Search user…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></Select></Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.subscriptions.length ? <Card><Empty title="No subscriptions" /></Card> : (
        <Table head={["User", "Plan", "Source", "Price", "Starts", "Ends", "Status"]}>{data.subscriptions.map((s) => (
          <tr key={s._id}><td className="p-4"><p className="font-semibold">{s.user?.username || "deleted"}</p><p className="text-xs opacity-60">{s.user?.email}</p></td><td><Badge tone="violet">{s.plan}</Badge></td><td className="opacity-70">{s.source}</td><td>{money(s.price)}</td><td className="opacity-70">{fmtDate(s.startDate)}</td><td className="opacity-70">{fmtDate(s.endDate)}</td>
            <td><Badge tone={s.status === "active" ? "emerald" : s.status === "expired" ? "slate" : "amber"}>{s.status}</Badge>{s.cancelAtPeriodEnd && s.status === "active" && <Badge tone="amber" className="ml-1">ending</Badge>}</td></tr>))}</Table>)}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}

export function Payments() {
  const toast = useToast(); const [status, setStatus] = useState("paid"); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/payments", { params: { status, page, limit: 20 } }), [status, page]);
  const refund = async (p) => { if (!window.confirm(`Refund ${money(p.amount)} to ${p.userId?.username}? Their purchased time is removed.`)) return; try { await api.post(`/admin/payments/${p._id}/refund`); toast("Refunded"); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <PageHeader title="Payments" />
      <div className="mb-5"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={["paid", "created", "refunded"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></div>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.payments.length ? <Card><Empty title="No payments" /></Card> : (
        <Table head={["Invoice", "User", "Plan", "Amount", "Coupon", "Mode", "Date", ""]}>{data.payments.map((p) => (
          <tr key={p._id}><td className="p-4 font-mono text-xs">{p.invoiceNumber || "—"}</td><td>{p.userId?.username || "deleted"}</td><td>{p.plan}</td><td className="font-semibold">{money(p.amount)}</td><td className="opacity-70">{p.couponCode || "—"}</td><td className="capitalize opacity-70">{p.mode}</td><td className="opacity-70">{fmtDate(p.paidAt || p.createdAt)}</td>
            <td className="pr-4 text-right">{p.status === "paid" && p.amount > 0 && <Button size="sm" variant="ghost" onClick={() => refund(p)}>Refund</Button>}</td></tr>))}</Table>)}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}
