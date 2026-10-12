import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clapperboard, Eye, EyeOff, XCircle } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md animate-rise">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/40"><Clapperboard size={22} /></span><span className="text-xl font-black">Stream<span className="gradient-text">ify</span></span></Link>
        <Card className="!p-7"><h1 className="text-2xl font-extrabold">{title}</h1>{subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}<div className="mt-6">{children}</div></Card>
        {footer && <p className="mt-5 text-center text-sm opacity-80">{footer}</p>}
      </div>
    </div>
  );
}
const PasswordInput = (p) => {
  const [show, setShow] = useState(false);
  return <div className="relative"><Input {...p} type={show ? "text" : "password"} className="pr-11" />
    <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>;
};

/** Google Identity Services button (only rendered when VITE_GOOGLE_CLIENT_ID is set). */
function GoogleButton({ onToken }) {
  const ref = useRef();
  useEffect(() => {
    if (!GOOGLE_ID) return;
    const init = () => { window.google?.accounts.id.initialize({ client_id: GOOGLE_ID, callback: (r) => onToken(r.credential) }); window.google?.accounts.id.renderButton(ref.current, { theme: "filled_black", size: "large", width: 336, shape: "pill" }); };
    if (window.google?.accounts) return init();
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = init; document.body.appendChild(s);
  }, [onToken]);
  return GOOGLE_ID ? <><div className="my-4 flex items-center gap-3 text-xs opacity-60"><span className="h-px flex-1 bg-current opacity-30" />or<span className="h-px flex-1 bg-current opacity-30" /></div><div ref={ref} className="flex justify-center" /></> : null;
}

export function Login() {
  const { login, google } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState({ email: "", password: "" }); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await login(f.email, f.password); nav("/profiles", { replace: true }); } catch (err) { toast(err.response ? errMsg(err) : err.message, "error"); } finally { setBusy(false); } };
  return (
    <Shell title="Welcome back" subtitle="Log in to keep watching" footer={<>New to Streamify? <Link className="font-semibold text-fuchsia-500" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <div className="text-right"><Link to="/forgot-password" className="text-xs font-semibold text-fuchsia-500">Forgot password?</Link></div>
        <Button className="w-full" size="lg" loading={busy}>Log in</Button>
      </form>
      <GoogleButton onToken={async (t) => { try { await google(t); nav("/profiles", { replace: true }); } catch (e) { toast(errMsg(e), "error"); } }} />
    </Shell>
  );
}

export function Register() {
  const { register, google } = useAuth(); const nav = useNavigate(); const toast = useToast(); const [sp] = useSearchParams();
  const [f, setF] = useState({ username: "", email: "", password: "", referralCode: sp.get("ref") || "" }); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const body = { ...f }; if (!body.referralCode) delete body.referralCode; await register(body); toast("Welcome to Streamify!"); nav("/profiles", { replace: true }); }
    catch (err) { toast(err.response ? errMsg(err) : err.message, "error"); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" subtitle="Start with a free trial" footer={<>Already a member? <Link className="font-semibold text-fuchsia-500" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username" hint="3-20 characters: letters, numbers, . _ -"><Input required minLength={3} maxLength={20} pattern="[A-Za-z0-9_.\-]+" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number"><PasswordInput required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Referral code (optional)"><Input maxLength={20} value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: e.target.value.toUpperCase() })} /></Field>
        <Button className="w-full" size="lg" loading={busy}>Create account</Button>
      </form>
      <GoogleButton onToken={async (t) => { try { await google(t); nav("/profiles", { replace: true }); } catch (e) { toast(errMsg(e), "error"); } }} />
    </Shell>
  );
}

export function ForgotPassword() {
  const toast = useToast(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post("/auth/forgot-password", { email }); setSent(true); } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); } };
  return (
    <Shell title="Reset password" subtitle="We will email you a reset link" footer={<Link className="font-semibold text-fuchsia-500" to="/login">Back to login</Link>}>
      {sent ? <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">If that email exists, a reset link is on its way.</p>
        : <form onSubmit={submit} className="space-y-4"><Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Button className="w-full" loading={busy}>Send reset link</Button></form>}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast(); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post("/auth/reset-password", { token: sp.get("token") || "", password }); toast("Password updated. Please log in."); nav("/login"); } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); } };
  return (
    <Shell title="Choose a new password" footer={<Link className="font-semibold text-fuchsia-500" to="/login">Back to login</Link>}>
      <form onSubmit={submit} className="space-y-4"><Field label="New password" hint="At least 8 characters with a letter and a number"><PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Button className="w-full" loading={busy}>Update password</Button></form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams(); const [s, setS] = useState({ loading: true, ok: false, msg: "" });
  useEffect(() => { api.post("/auth/verify-email", { token: sp.get("token") || "" }).then(() => setS({ loading: false, ok: true, msg: "Your email is verified." })).catch((e) => setS({ loading: false, ok: false, msg: errMsg(e) })); }, [sp]);
  return (
    <Shell title="Email verification" footer={<Link className="font-semibold text-fuchsia-500" to="/login">Continue</Link>}>
      {s.loading ? <Spinner /> : <div className="flex flex-col items-center gap-3 py-4 text-center">{s.ok ? <CheckCircle2 size={48} className="text-emerald-500" /> : <XCircle size={48} className="text-rose-500" />}<p className="font-semibold">{s.msg}</p></div>}
    </Shell>
  );
}
