import { NavLink, Outlet } from "react-router-dom";
import { cx } from "../../lib/utils";

const TABS = [["/admin", "Overview"], ["/admin/users", "Users"], ["/admin/subscriptions", "Subscriptions"], ["/admin/payments", "Payments"], ["/admin/coupons", "Coupons"], ["/admin/reviews", "Reviews"], ["/admin/tools", "Tools"]];
export default function AdminLayout() {
  return (
    <>
      <div className="glass no-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5">
        {TABS.map(([to, l]) => <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => cx("whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition", isActive ? "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white shadow" : "opacity-75 hover:bg-white/10 hover:opacity-100")}>{l}</NavLink>)}
      </div>
      <Outlet />
    </>
  );
}
