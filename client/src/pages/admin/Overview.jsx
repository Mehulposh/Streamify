import { useState } from "react";
import { AlertTriangle, Crown, IndianRupee, TrendingDown, Users } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { BarChart, Card, ErrorBox, HBars, PageHeader, Select, Spinner, Stat } from "../../components/ui";
import { money } from "../../lib/utils";

const mlabel = (m) => new Date(m + "-01").toLocaleString("en", { month: "short" });
const kfmt = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);

export default function Overview() {
  const [months, setMonths] = useState(6);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/analytics/overview", { params: { months } }), [months]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const t = data.totals, pop = data.popular;
  const List = ({ title, items, val }) => (
    <Card><h3 className="mb-4 font-bold">{title}</h3>{!items.length ? <p className="text-sm opacity-60">No data yet.</p> : (
      <ol className="space-y-3">{items.slice(0, 6).map((x, i) => <li key={`${x.mediaType}${x.id}`} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-fuchsia-500/15 text-xs font-bold text-fuchsia-500">{i + 1}</span>
        <Link to={`/title/${x.mediaType}/${x.id}`} className="flex-1 truncate font-semibold hover:text-fuchsia-500">{x.title || `#${x.id}`}</Link><span className="text-xs opacity-60">{val(x)}</span></li>)}</ol>)}</Card>
  );
  return (
    <>
      <PageHeader title="Overview" subtitle="Revenue, subscribers and what people watch"
        action={<Select className="!w-40" value={months} onChange={(e) => setMonths(Number(e.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></Select>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={IndianRupee} label="Revenue" value={money(t.revenue)} tone="emerald" />
        <Stat icon={Crown} label="Active subscribers" value={t.activeSubscribers} tone="violet" />
        <Stat icon={TrendingDown} label="Churn (30 days)" value={`${t.churnRate30d}%`} tone="amber" sub={`${t.churned30d} ended`} />
        <Stat icon={Users} label="Users" value={t.users} />
      </div>
      {(t.reviewsToModerate > 0 || t.reportedReviews > 0) && <Link to="/admin/reviews" className="glass mt-5 flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold"><AlertTriangle className="text-amber-500" /> {t.reviewsToModerate} review(s) waiting · {t.reportedReviews} reported</Link>}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card><h3 className="mb-4 font-bold">Revenue per month</h3><BarChart format={kfmt} color="from-emerald-500 to-teal-300" data={data.revenueByMonth.map((m) => ({ label: mlabel(m.month), value: m.revenue }))} /></Card>
        <Card><h3 className="mb-4 font-bold">New users per month</h3><BarChart data={data.newUsersByMonth.map((m) => ({ label: mlabel(m.month), value: m.users }))} color="from-rose-500 to-fuchsia-400" /></Card>
        <Card><h3 className="mb-4 font-bold">Subscribers by plan</h3>{Object.keys(data.subscribersByPlan).length ? <HBars data={Object.entries(data.subscribersByPlan).map(([label, value]) => ({ label, value }))} /> : <p className="text-sm opacity-60">No active subscribers yet.</p>}</Card>
        <List title="Most saved to watchlists" items={pop.mostSaved} val={(x) => `${x.saves} saves`} />
        <List title="Most watched" items={pop.mostWatched} val={(x) => `${x.viewers} viewers`} />
        <List title="Top rated by members" items={pop.topRated} val={(x) => `★ ${x.avg} (${x.votes})`} />
      </div>
    </>
  );
}
