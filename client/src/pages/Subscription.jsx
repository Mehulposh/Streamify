import { useState } from "react";
import { Check, Copy, Crown, Gift, Receipt, Tag, Timer } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge, Button, Card, Empty, Input, PageHeader, Spinner } from "../components/ui";
import { cx, fmtDate, mmss, money } from "../lib/utils";

const loadRazorpay = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load the payment gateway")); document.body.appendChild(s);
});

export default function Subscription() {
  const { user, access, refresh } = useAuth(); const toast = useToast();
  const plans = useFetch(() => api.get("/subscription/plans"), []);
  const sub = useFetch(() => api.get("/subscription/get"), []);
  const pays = useFetch(() => api.get("/payments/mine"), []);
  const [plan, setPlan] = useState("3months"); const [code, setCode] = useState(""); const [quote, setQuote] = useState(null); const [busy, setBusy] = useState(false); const [redeem, setRedeem] = useState("");
  const current = sub.data?.status ? sub.data.subscription : null;
  const reloadAll = async () => { await refresh(); sub.reload(true); pays.reload(true); };

  const choose = (id) => { setPlan(id); setQuote(null); };
  const apply = async () => {
    try { const { data } = await api.post("/coupons/validate", { code, plan }); setQuote(data); toast("Coupon applied"); } catch (e) { setQuote(null); toast(errMsg(e), "error"); }
  };
  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/order", { plan, couponCode: quote ? code : undefined });
      if (data.activated) { toast("Subscription activated 🎉"); return reloadAll(); }
      if (data.order.mock) { await api.post("/payments/mock-confirm", { orderId: data.order.orderId }); toast("Test payment confirmed (mock mode)"); return reloadAll(); }
      await loadRazorpay();
      new window.Razorpay({ key: data.order.keyId, order_id: data.order.orderId, amount: data.order.amount, currency: data.order.currency, name: "Streamify", description: `${plan} plan`, theme: { color: "#c026d3" },
        prefill: { email: user.email, name: user.username },
        handler: async (r) => { try { await api.post("/payments/verify", r); toast("Payment successful 🎉"); reloadAll(); } catch (e) { toast(errMsg(e), "error"); } } }).open();
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  const act = async (fn, ok) => { try { await fn(); toast(ok); reloadAll(); } catch (e) { toast(errMsg(e), "error"); } };
  const link = `${window.location.origin}/register?ref=${user.referralCode}`;

  if (plans.loading) return <Spinner />;
  const list = plans.data.plans, chosen = list.find((p) => p.id === plan);
  return (
    <>
      <PageHeader title="Subscription" subtitle="Pick a plan. Buying again simply extends your current one." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-1">
          <h3 className="flex items-center gap-2 font-bold"><Crown size={18} className="text-amber-500" /> Your access</h3>
          {current ? (<>
            <div className="flex items-center gap-2"><Badge tone="emerald">Active</Badge><Badge tone="violet">{current.plan}</Badge>{current.cancelAtPeriodEnd && <Badge tone="amber">Ends soon</Badge>}</div>
            <p className="text-sm opacity-80">Valid until <b>{fmtDate(current.endDate)}</b></p>
            {current.cancelAtPeriodEnd ? <Button variant="soft" size="sm" onClick={() => act(() => api.post("/subscription/resume"), "Subscription resumed")}>Keep my plan</Button>
              : <Button variant="ghost" size="sm" onClick={() => window.confirm("Cancel? You keep access until the end date.") && act(() => api.post("/subscription/cancel"), "Cancelled. Access continues until the end date.")}>Cancel plan</Button>}
          </>) : access?.reason === "trial" ? <p className="flex items-center gap-2 text-sm"><Timer size={16} className="text-amber-500" /> Free trial: <b>{mmss(access.trialRemainingSeconds || 0)}</b> left</p>
            : (<>
              <p className="text-sm opacity-80">{access?.reason === "trial_expired" ? "Your free trial has ended." : "You do not have an active plan."}</p>
              {access?.reason === "no_plan" && <Button variant="soft" size="sm" onClick={() => act(() => api.post("/access/start-trial"), "Free trial started")}><Timer size={14} /> Start free trial</Button>}</>)}
          <div className="border-t border-slate-500/15 pt-3"><p className="label">Have a gift or trial code?</p>
            <div className="flex gap-2"><Input placeholder="CODE" value={redeem} onChange={(e) => setRedeem(e.target.value.toUpperCase())} /><Button variant="ghost" disabled={redeem.length < 3} onClick={() => act(() => api.post("/coupons/redeem", { code: redeem }).then(() => setRedeem("")), "Free days added")}><Gift size={15} /></Button></div></div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((p) => (
              <button key={p.id} onClick={() => choose(p.id)} className={cx("glass relative rounded-3xl p-5 text-left transition hover:-translate-y-1", plan === p.id && "ring-2 ring-fuchsia-500 shadow-fuchsia-500/30")}>
                {p.id === "1year" && <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">Best value</span>}
                <p className="text-sm font-semibold opacity-70">{p.name}</p><p className="mt-1 text-3xl font-black">{money(p.price)}</p><p className="text-xs opacity-60">≈ {money(p.perMonth)}/month</p>
                {plan === p.id && <Check size={18} className="absolute bottom-4 right-4 text-fuchsia-500" />}
              </button>))}
          </div>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><Tag size={16} className="text-fuchsia-500" /><Input className="!w-48" placeholder="Coupon code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} /><Button variant="ghost" disabled={code.length < 3} onClick={apply}>Apply</Button></div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>{chosen?.name} plan</span><b>{money(chosen?.price)}</b></div>
              {quote && <div className="flex justify-between text-emerald-500"><span>Coupon {quote.code}</span><b>−{money(quote.pricing.discount)}</b></div>}
              <div className="flex justify-between border-t border-slate-500/20 pt-2 text-lg"><span>Total</span><b>{money(quote ? quote.pricing.amount : chosen?.price)}</b></div>
            </div>
            <Button size="lg" className="w-full" loading={busy} onClick={pay}>{current ? "Extend my plan" : "Subscribe now"}</Button>
            {plans.data.paymentMode === "mock" && <p className="text-center text-xs text-amber-500">Test mode: payments are simulated and activate instantly.</p>}
            {plans.data.paymentMode === "disabled" && <p className="text-center text-xs text-rose-500">Payments are not enabled on this server.</p>}
          </Card>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card><h3 className="mb-3 flex items-center gap-2 font-bold"><Receipt size={18} /> Payment history</h3>
          {!pays.data?.payments?.length ? <Empty title="No payments yet" /> : (
            <div className="divide-y divide-slate-500/15">{pays.data.payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div><p className="font-semibold">{p.plan} · {money(p.amount)}</p><p className="text-xs opacity-60">{fmtDate(p.paidAt || p.createdAt)} · {p.status}</p></div>
                {["paid", "refunded"].includes(p.status) && <a href={`/api/payments/${p._id}/invoice?format=html`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-fuchsia-500">Invoice</a>}</div>))}</div>)}</Card>
        <Card className="space-y-3 bg-gradient-to-br from-rose-500/10 to-violet-500/10"><h3 className="flex items-center gap-2 font-bold"><Gift size={18} className="text-fuchsia-500" /> Invite friends, get free days</h3>
          <p className="text-sm opacity-80">When a friend you invite buys their first plan, you get free days added to your subscription.</p>
          <div className="flex gap-2"><code className="glass flex-1 truncate rounded-xl px-3 py-2 text-sm font-bold tracking-widest">{user.referralCode}</code><Button variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast("Invite link copied"); }}><Copy size={15} /> Copy link</Button></div></Card>
      </div>
    </>
  );
}
