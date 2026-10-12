import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useProfile } from "../context/ProfileContext";
import { useToast } from "../context/ToastContext";
import { Badge, Button, Field, Input, Modal, ProfileAvatar, Select, Spinner, Switch } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import { AVATARS, LANGS, cx } from "../lib/utils";

const MAX = 5;
const Header = ({ right }) => (
  <header className="flex items-center justify-between p-4 sm:p-6">
    <Link to="/" className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white"><Clapperboard size={18} /></span><span className="text-lg font-black">Stream<span className="gradient-text">ify</span></span></Link>
    <div className="flex items-center gap-2">{right}<ThemeToggle /></div>
  </header>
);

/** "Who's watching?" */
export function ProfilePicker() {
  const { profiles, loaded, select } = useProfile(); const nav = useNavigate(); const toast = useToast();
  const [lock, setLock] = useState(null); const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false);
  const pick = async (p) => { if (p.hasPin) { setLock(p); setPin(""); return; } await go(p); };
  const go = async (p, code) => { setBusy(true); try { await select(p, code); nav("/", { replace: true }); } catch (e) { toast(errMsg(e), "error"); setPin(""); } finally { setBusy(false); } };
  if (!loaded) return <Spinner className="min-h-screen" />;
  return (
    <div className="min-h-screen">
      <Header right={<Link to="/profiles/manage"><Button variant="ghost" size="sm"><Pencil size={14} /> Manage</Button></Link>} />
      <div className="mx-auto max-w-4xl px-4 py-10 text-center animate-rise">
        <h1 className="text-3xl font-black sm:text-5xl">Who is <span className="gradient-text">watching?</span></h1>
        <div className="mt-12 flex flex-wrap justify-center gap-6 sm:gap-10">
          {profiles.map((p) => (
            <button key={p._id} onClick={() => pick(p)} className="group w-28 sm:w-36">
              <div className="relative mx-auto transition duration-300 group-hover:scale-110"><ProfileAvatar profile={p} size={window.innerWidth < 640 ? 96 : 128} className="ring-4 ring-transparent group-hover:ring-fuchsia-400" />
                {p.hasPin && <span className="glass absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full"><Lock size={14} /></span>}</div>
              <p className="mt-4 truncate font-semibold">{p.name}</p>{p.isKids && <Badge tone="sky" className="mt-1">Kids</Badge>}
            </button>))}
          {profiles.length < MAX && <Link to="/profiles/manage?new=1" className="group w-28 sm:w-36"><div className="glass mx-auto grid h-24 w-24 place-items-center rounded-2xl transition group-hover:scale-110 sm:h-32 sm:w-32"><Plus size={34} /></div><p className="mt-4 font-semibold opacity-80">Add profile</p></Link>}
        </div>
      </div>
      <Modal open={!!lock} onClose={() => setLock(null)} title={`Enter PIN for ${lock?.name}`}>
        <form onSubmit={(e) => { e.preventDefault(); go(lock, pin); }} className="space-y-4">
          <Input autoFocus inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.6em]" />
          <Button className="w-full" loading={busy} disabled={pin.length !== 4}>Unlock</Button>
        </form>
      </Modal>
    </div>
  );
}

/** Create / edit / delete profiles (kids mode, language, daily limit, PIN) */
export function ManageProfiles() {
  const { profiles, loaded, load } = useProfile(); const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({}); const [busy, setBusy] = useState(false);
  const open = (p) => { setEdit(p); setF(p._id ? { name: p.name, avatar: p.avatar, isKids: p.isKids, language: p.language, dailyLimitMinutes: p.dailyLimitMinutes || 0, hasPin: p.hasPin, newPin: "", currentPin: "" } : { name: "", avatar: "avatar1", isKids: false, language: "en-US", dailyLimitMinutes: 0, hasPin: false, newPin: "", currentPin: "" }); };
  const startNew = () => open({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new")) startNew(); }, []);
  if (!loaded) return <Spinner className="min-h-screen" />;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name, avatar: f.avatar, isKids: f.isKids, language: f.language, dailyLimitMinutes: Number(f.dailyLimitMinutes) || 0 };
      if (edit._id) {
        if (f.hasPin && f.currentPin) body.currentPin = f.currentPin;
        if (f.newPin) body.pin = f.newPin; else if (f.removePin) body.pin = null;
        await api.patch(`/profiles/${edit._id}`, body);
      } else { if (f.newPin) body.pin = f.newPin; await api.post("/profiles", body); }
      toast("Profile saved"); setEdit(null); load();
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  const del = async () => {
    const pin = edit.hasPin ? window.prompt("Enter this profile's PIN to delete it") : undefined;
    if (!window.confirm(`Delete “${edit.name}” and all its watchlist, history and ratings?`)) return;
    try { await api.delete(`/profiles/${edit._id}`, { data: pin ? { pin } : {} }); toast("Profile deleted"); setEdit(null); load(); } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="min-h-screen">
      <Header right={<Link to="/profiles"><Button size="sm">Done</Button></Link>} />
      <div className="mx-auto max-w-3xl px-4 py-8 animate-rise">
        <h1 className="mb-8 text-center text-3xl font-black">Manage profiles</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <button key={p._id} onClick={() => open(p)} className="glass flex items-center gap-4 rounded-2xl p-4 text-left transition hover:scale-[1.02]">
              <ProfileAvatar profile={p} size={56} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.name}</p><p className="text-xs opacity-60">{p.isKids ? "Kids · " : ""}{p.hasPin ? "PIN · " : ""}{p.dailyLimitMinutes ? `${p.dailyLimitMinutes} min/day` : "No limit"}</p></div><Pencil size={16} className="opacity-60" />
            </button>))}
          {profiles.length < MAX && <button onClick={startNew} className="glass flex items-center justify-center gap-2 rounded-2xl p-4 font-semibold transition hover:scale-[1.02]"><Plus size={18} /> Add profile</button>}
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? "Edit profile" : "New profile"}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><Input maxLength={30} value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div><p className="label">Avatar</p><div className="flex flex-wrap gap-2">{AVATARS.map(([id]) => <button key={id} type="button" onClick={() => setF({ ...f, avatar: id })} className={cx("rounded-2xl p-0.5 ring-2 transition", f.avatar === id ? "ring-fuchsia-500" : "ring-transparent")}><ProfileAvatar profile={{ avatar: id }} size={44} /></button>)}</div></div>
            <Field label="Language"><Select value={f.language || "en-US"} onChange={(e) => setF({ ...f, language: e.target.value })}>{LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select></Field>
            <Switch checked={!!f.isKids} onChange={(v) => setF({ ...f, isKids: v })} label="Kids profile (family-friendly titles only)" />
            <Field label="Daily watch limit (minutes, 0 = none)"><Input type="number" min="0" max="1440" value={f.dailyLimitMinutes ?? 0} onChange={(e) => setF({ ...f, dailyLimitMinutes: e.target.value })} /></Field>
            {f.hasPin && <Field label="Current PIN (needed to change this profile)"><Input inputMode="numeric" maxLength={4} value={f.currentPin || ""} onChange={(e) => setF({ ...f, currentPin: e.target.value.replace(/\D/g, "") })} /></Field>}
            <Field label={f.hasPin ? "New PIN (4 digits, leave empty to keep)" : "PIN lock (4 digits, optional)"}><Input inputMode="numeric" maxLength={4} value={f.newPin || ""} onChange={(e) => setF({ ...f, newPin: e.target.value.replace(/\D/g, "") })} /></Field>
            {f.hasPin && <Switch checked={!!f.removePin} onChange={(v) => setF({ ...f, removePin: v })} label="Remove the PIN" />}
            <div className="flex items-center justify-between gap-2">
              {edit._id ? <Button variant="ghost" className="!text-rose-500" onClick={del}><Trash2 size={15} /> Delete</Button> : <span />}
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} disabled={!f.name?.trim() || (f.newPin && f.newPin.length !== 4)} onClick={save}>Save</Button></div>
            </div>
          </div>)}
      </Modal>
    </div>
  );
}
