import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import api from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Button, Card, Empty, PageHeader, Spinner } from "../components/ui";
import { cx, timeAgo } from "../lib/utils";

export default function Notifications() {
  const { data, loading, reload } = useFetch(() => api.get("/notifications", { params: { limit: 50 } }), []);
  const readAll = async () => { await api.post("/notifications/read-all"); reload(true); };
  const open = async (n) => { if (!n.read) { await api.post(`/notifications/${n._id}/read`); reload(true); } };
  return (
    <>
      <PageHeader title="Notifications" subtitle={data ? `${data.unread} unread` : ""} action={data?.unread > 0 && <Button variant="ghost" size="sm" onClick={readAll}><CheckCheck size={16} /> Mark all read</Button>} />
      {loading ? <Spinner /> : !data.notifications.length ? <Card><Empty icon={Bell} title="You are all caught up" text="Release reminders, plan updates and friend activity show up here." /></Card> : (
        <div className="space-y-2.5">{data.notifications.map((n) => {
          const body = (<Card className={cx("flex items-start gap-3 !p-4 transition hover:-translate-y-0.5", !n.read && "ring-2 ring-fuchsia-400/40")} onClick={() => open(n)}>
            <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", n.read ? "bg-slate-400/50" : "bg-fuchsia-500")} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p><p className="break-words text-sm opacity-80">{n.body}</p></div><span className="shrink-0 text-xs opacity-60">{timeAgo(n.createdAt)}</span></Card>);
          return n.link && n.link.startsWith("/") ? <Link key={n._id} to={n.link} className="block">{body}</Link> : <div key={n._id}>{body}</div>;
        })}</div>)}
    </>
  );
}
