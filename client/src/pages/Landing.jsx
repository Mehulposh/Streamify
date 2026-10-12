import { Link } from "react-router-dom";
import { ArrowRight, Clapperboard, Gift, ListVideo, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { Button, Card } from "../components/ui";

const FEATURES = [
  [Sparkles, "Picked for you", "Rows built from what you save, watch and rate on each profile."],
  [Users, "Profiles for everyone", "Kids mode, PIN-locked profiles and daily watch limits."],
  [ListVideo, "Lists you can share", "Build “Weekend picks” and send a public link to friends."],
  [ShieldCheck, "Safe by design", "Server-side access, private data per profile, honest reviews."],
  [Zap, "Pick up where you left off", "Continue watching on every device, instantly."],
  [Gift, "Invite and earn", "Free days for you when a friend subscribes."],
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="glass sticky top-3 z-30 mt-3 flex items-center justify-between rounded-2xl px-4 py-3">
        <Link to="/" className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white"><Clapperboard size={18} /></span><span className="text-lg font-black">Stream<span className="gradient-text">ify</span></span></Link>
        <div className="flex items-center gap-2"><ThemeToggle /><Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link><Link to="/register"><Button size="sm">Get started</Button></Link></div>
      </header>
      <section className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        <div className="animate-rise">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"><Sparkles size={14} className="text-amber-500" /> Free trial. No card needed.</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Movies and series, <span className="gradient-text">made for you</span></h1>
          <p className="mt-5 max-w-xl text-lg opacity-80">Discover trending titles, track what you watch, rate and review, share lists with friends. One account, a profile for every person at home.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/register"><Button size="lg">Start free trial <ArrowRight size={18} /></Button></Link><Link to="/login"><Button size="lg" variant="ghost">I have an account</Button></Link></div>
        </div>
        <div className="relative animate-rise [animation-delay:150ms]">
          <div className="grid grid-cols-3 gap-3">
            {["from-rose-500 to-orange-400", "from-fuchsia-500 to-violet-600", "from-sky-500 to-indigo-600", "from-amber-400 to-rose-500", "from-emerald-400 to-teal-600", "from-violet-500 to-pink-500"].map((g, i) => (
              <div key={i} className={`glass aspect-[2/3] rounded-2xl bg-gradient-to-br ${g} p-3 ${i % 2 ? "translate-y-6" : ""} shadow-xl`}><div className="h-full rounded-xl bg-black/15" /></div>))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, t, d]) => <Card key={t} className="transition hover:-translate-y-1"><div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-500"><Icon size={22} /></div><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm opacity-75">{d}</p></Card>)}
      </section>
      <p className="mt-12 text-center text-xs opacity-60">Movie data by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </div>
  );
}
