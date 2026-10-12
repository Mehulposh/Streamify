import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, Clapperboard, Clock, CreditCard, LogOut, Menu, Search, Settings, Shield, Users, X } from "lucide-react";
import api, { img } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useDebounced, useFetch, useInterval } from "../lib/hooks";
import { cx } from "../lib/utils";
import { ProfileAvatar } from "./ui";
import ThemeToggle from "./ThemeToggle";

const LINKS = [["/", "Home"], ["/movies", "Movies"], ["/series", "Series"], ["/watchlist", "Watchlist"], ["/lists", "Lists"], ["/friends", "Friends"]];

export default function Navbar() {
  const { user, logout } = useAuth(); const { active, leave } = useProfile(); const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false); const [menu, setMenu] = useState(false); const [pm, setPm] = useState(false);
  const [q, setQ] = useState(""); const [focus, setFocus] = useState(false); const [sug, setSug] = useState({ suggestions: [], recent: [] }); const [recent, setRecent] = useState([]);
  const box = useRef(), pmRef = useRef();
  const dq = useDebounced(q, 300);
  const unread = useFetch(() => api.get("/notifications/unread-count"), []);
  useInterval(() => unread.reload(true), 30000);

  useEffect(() => { const f = () => setScrolled(window.scrollY > 20); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setFocus(false); if (pmRef.current && !pmRef.current.contains(e.target)) setPm(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!focus) return;
    if (dq.trim().length >= 2) api.get("/search/suggest", { params: { q: dq.trim() } }).then((r) => setSug(r.data)).catch(() => {});
    else { setSug({ suggestions: [], recent: [] }); api.get("/search/history").then((r) => setRecent(r.data.terms)).catch(() => {}); }
  }, [dq, focus]);

  const go = (term) => {
    const t = term.trim(); if (!t) return;
    api.post("/search/history", { term: t }).catch(() => {});
    setFocus(false); setMenu(false); setQ(t); nav(`/search?q=${encodeURIComponent(t)}`);
  };
  const out = async () => { await logout(); nav("/"); };

  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-fuchsia-500/10";
  return (
    <header className={cx("fixed inset-x-0 top-0 z-50 transition-all duration-300", scrolled ? "px-2 pt-2 sm:px-4" : "px-0 pt-0")}>
      <div className={cx("mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 transition-all duration-300 sm:gap-5 sm:px-5", scrolled ? "glass rounded-2xl" : "bg-gradient-to-b from-black/40 to-transparent dark:from-black/60")}>
        <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X size={20} /> : <Menu size={20} />}</button>
        <Link to="/" className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/40"><Clapperboard size={19} /></span>
          <span className="hidden text-lg font-black tracking-tight sm:block">Stream<span className="gradient-text">ify</span></span></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([to, l]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => cx("rounded-xl px-3.5 py-2 text-sm font-semibold transition", isActive ? "bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300" : "opacity-80 hover:bg-white/10 hover:opacity-100")}>{l}</NavLink>)}
        </nav>

        <div ref={box} className="relative ml-auto w-full max-w-xs sm:max-w-sm">
          <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="glass flex items-center gap-2 rounded-xl px-3">
            <Search size={17} className="shrink-0 opacity-60" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} placeholder="Search titles…" aria-label="Search" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:opacity-60" />
          </form>
          {focus && (sug.suggestions.length > 0 || sug.recent.length > 0 || (!q && recent.length > 0)) && (
            <div className="glass-strong absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto rounded-2xl p-2 animate-fade">
              {(q.trim().length >= 2 ? sug.recent : recent).slice(0, 5).map((t) => <button key={t} onClick={() => go(t)} className={cx(item, "w-full")}><Clock size={15} className="opacity-60" /> {t}</button>)}
              {q.trim().length >= 2 && sug.suggestions.map((s) => (
                <Link key={`${s.mediaType}-${s.id}`} to={`/title/${s.mediaType}/${s.id}`} onClick={() => { setFocus(false); setQ(""); }} className={cx(item, "gap-3")}>
                  {s.poster_path ? <img src={img(s.poster_path, "w92")} alt="" className="h-12 w-8 rounded object-cover" /> : <div className="h-12 w-8 rounded bg-white/10" />}
                  <span className="min-w-0"><span className="block truncate font-semibold">{s.title}</span><span className="text-xs opacity-60">{s.mediaType === "tv" ? "Series" : "Movie"} {s.year && `· ${s.year}`}</span></span></Link>))}
            </div>)}
        </div>

        <ThemeToggle className="hidden sm:grid" />
        <Link to="/notifications" aria-label="Notifications" className="glass relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:scale-105">
          <Bell size={18} />{unread.data?.unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread.data.unread > 9 ? "9+" : unread.data.unread}</span>}
        </Link>
        <div ref={pmRef} className="relative">
          <button onClick={() => setPm(!pm)} aria-label="Profile menu" className="flex items-center rounded-2xl ring-2 ring-transparent transition hover:ring-fuchsia-400"><ProfileAvatar profile={active} size={40} /></button>
          {pm && (
            <div className="glass-strong absolute right-0 top-full mt-2 w-60 rounded-2xl p-2 animate-fade">
              <div className="mb-1 flex items-center gap-3 border-b border-slate-500/15 p-2.5"><ProfileAvatar profile={active} size={36} /><div className="min-w-0"><p className="truncate text-sm font-bold">{active?.name}{active?.isKids && " · Kids"}</p><p className="truncate text-xs opacity-60">{user.email}</p></div></div>
              <button className={cx(item, "w-full")} onClick={() => { leave(); nav("/profiles"); }}><Users size={16} /> Switch profile</button>
              <Link to="/subscription" className={item} onClick={() => setPm(false)}><CreditCard size={16} /> Subscription</Link>
              <Link to="/history" className={item} onClick={() => setPm(false)}><Clock size={16} /> History & ratings</Link>
              <Link to="/settings" className={item} onClick={() => setPm(false)}><Settings size={16} /> Settings</Link>
              {user.role === "admin" && <Link to="/admin" className={item} onClick={() => setPm(false)}><Shield size={16} /> Admin</Link>}
              <button className={cx(item, "w-full !text-rose-500")} onClick={out}><LogOut size={16} /> Log out</button>
              <div className="mt-1 border-t border-slate-500/15 p-1 sm:hidden"><ThemeToggle /></div>
            </div>)}
        </div>
      </div>
      {menu && (
        <div className="glass-strong mx-2 mt-2 rounded-2xl p-2 animate-fade lg:hidden">
          {LINKS.map(([to, l]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setMenu(false)} className={({ isActive }) => cx(item, isActive && "bg-fuchsia-500/15 text-fuchsia-500")}>{l}</NavLink>)}
        </div>)}
    </header>
  );
}
