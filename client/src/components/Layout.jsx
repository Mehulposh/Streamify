import { Link, Outlet } from "react-router-dom";
import { Clock, Crown } from "lucide-react";
import Navbar from "./Navbar";
import PaywallModal from "./PaywallModal";
import { useAuth } from "../context/AuthContext";
import { mmss } from "../lib/utils";

export default function Layout({ children }) {
  const { access, user } = useAuth();
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-[1600px] px-3 pb-16 pt-20 sm:px-5 sm:pt-24">
        {user && !user.emailVerified && <Link to="/settings" className="glass mb-4 block rounded-2xl p-3 text-center text-sm">Please verify your email. Resend the link in <b className="text-fuchsia-500">Settings</b>.</Link>}
        {access?.reason === "trial" && <Link to="/subscription" className="glass mb-4 flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold"><Clock size={16} className="text-amber-500" /> Free trial: {mmss(access.trialRemainingSeconds || 0)} left. <span className="text-fuchsia-500 underline">Pick a plan</span></Link>}
        {access && !access.hasAccess && <Link to="/subscription" className="glass mb-4 flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold"><Crown size={16} className="text-amber-500" /> Subscribe to watch trailers and track progress. <span className="text-fuchsia-500 underline">See plans</span></Link>}
        {children ?? <Outlet />}
      </main>
      <PaywallModal />
    </>
  );
}
