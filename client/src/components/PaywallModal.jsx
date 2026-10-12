import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Timer } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button, Modal } from "./ui";

/** Global paywall: opens whenever the server answers 402 SUBSCRIPTION_REQUIRED. */
export default function PaywallModal() {
  const { access, refresh } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const h = () => { refresh(); setOpen(true); }; window.addEventListener("paywall", h); return () => window.removeEventListener("paywall", h); }, [refresh]);
  const trialUsed = access?.reason === "trial_expired";
  const startTrial = async () => {
    setBusy(true);
    try { await api.post("/access/start-trial"); await refresh(); toast("Free trial started. Enjoy!"); setOpen(false); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Unlock Streamify">
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/40"><Crown size={30} /></div>
        <p className="text-slate-600 dark:text-slate-300">{trialUsed ? "Your free trial has ended. Pick a plan to keep watching trailers, tracking progress and more." : "Watching needs an active plan or the free trial."}</p>
        <div className="grid gap-2">
          <Button size="lg" onClick={() => { setOpen(false); nav("/subscription"); }}>See plans</Button>
          {access?.reason === "no_plan" && <Button variant="ghost" loading={busy} onClick={startTrial}><Timer size={16} /> Start free trial</Button>}
        </div>
      </div>
    </Modal>
  );
}
