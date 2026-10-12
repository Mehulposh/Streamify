import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Gift, LogOut, Moon, ShieldCheck, Trash2, Users } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Switch } from "../components/ui";

export default function Settings() {
  const { user, refresh, logout } = useAuth(); const { leave } = useProfile(); const { theme, toggle } = useTheme(); const toast = useToast(); const nav = useNavigate();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" }); const [busy, setBusy] = useState(""); const [del, setDel] = useState(false); const [confirm, setConfirm] = useState("");
  const run = async (key, fn, ok) => { setBusy(key); try { await fn(); toast(ok); await refresh(); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); } };
  const settings = (body, ok) => run("s", () => api.patch("/auth/settings", body), ok);
  const link = `${window.location.origin}/register?ref=${user.referralCode}`;
  const remove = async () => {
    setBusy("del");
    try { await api.delete("/auth/account", { data: user.hasPassword === false ? { confirm } : { password: confirm } }); toast("Your account was deleted"); await logout(); nav("/"); }
    catch (e) { try { await api.delete("/auth/account", { data: { confirm } }); toast("Your account was deleted"); await logout(); nav("/"); } catch (e2) { toast(errMsg(e2), "error"); } } finally { setBusy(""); }
  };
  return (
    <>
      <PageHeader title="Settings" subtitle="Account, privacy and security" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5">
          <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-2xl font-black text-white">{user.username[0].toUpperCase()}</div>
            <div><p className="text-lg font-bold">{user.username}</p><p className="text-sm opacity-70">{user.email}</p><div className="mt-1 flex gap-1.5"><Badge tone={user.emailVerified ? "emerald" : "amber"}>{user.emailVerified ? "Email verified" : "Email not verified"}</Badge>{user.role === "admin" && <Badge tone="violet">Admin</Badge>}</div></div></div>
          {!user.emailVerified && <Button variant="soft" size="sm" loading={busy === "v"} onClick={() => run("v", () => api.post("/auth/resend-verification"), "Verification email sent")}>Resend verification email</Button>}
          <Field label="Notification language"><Select value={user.language} onChange={(e) => settings({ language: e.target.value }, "Language updated")}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option></Select></Field>
          <Switch checked={!!user.shareActivity} onChange={(v) => settings({ shareActivity: v }, v ? "Friends can now see your activity" : "Your activity is private")} label="Share my ratings and finished titles with people who follow me" />
          <Switch checked={theme === "dark"} onChange={toggle} label="Dark theme" />
          <div className="flex flex-wrap gap-2"><Link to="/profiles/manage" onClick={leave}><Button variant="ghost" size="sm"><Users size={14} /> Manage profiles</Button></Link><Button variant="ghost" size="sm" onClick={async () => { await logout(); nav("/"); }}><LogOut size={14} /> Log out</Button></div>
        </Card>
        <div className="space-y-5">
          <Card className="space-y-4"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-emerald-500" /> Change password</h3>
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="8+ characters with a letter and a number"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Button variant="soft" loading={busy === "pw"} onClick={() => run("pw", async () => { await api.post("/auth/change-password", pw); setPw({ currentPassword: "", newPassword: "" }); }, "Password changed")}>Update password</Button></Card>
          <Card className="space-y-3"><h3 className="flex items-center gap-2 font-bold"><Gift size={18} className="text-fuchsia-500" /> Referral</h3>
            <div className="flex gap-2"><code className="glass flex-1 truncate rounded-xl px-3 py-2 text-sm font-bold tracking-widest">{user.referralCode}</code><Button variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast("Invite link copied"); }}><Copy size={15} /></Button></div></Card>
          {user.role !== "admin" && <Card className="space-y-3 border-rose-500/30"><h3 className="flex items-center gap-2 font-bold text-rose-500"><Trash2 size={18} /> Delete account</h3><p className="text-sm opacity-75">Permanently removes your profiles, watchlist, history, ratings, lists and reviews. Payment records are kept for accounting.</p><Button variant="danger" size="sm" onClick={() => setDel(true)}>Delete my account</Button></Card>}
        </div>
      </div>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <div className="space-y-4"><p className="text-sm opacity-80">This cannot be undone. Enter your password to confirm (signed in with Google? type <b>DELETE</b>).</p>
          <Input type="password" placeholder="Password or DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDel(false)}>Keep my account</Button><Button variant="danger" loading={busy === "del"} disabled={!confirm} onClick={remove}>Delete forever</Button></div></div>
      </Modal>
    </>
  );
}
