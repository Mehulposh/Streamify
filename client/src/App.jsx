import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useProfile } from "./context/ProfileContext";
import Background from "./components/Background";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";

import Landing from "./pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/Auth";
import { ProfilePicker, ManageProfiles } from "./pages/Profiles";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Search from "./pages/Search";
import Details from "./pages/Details";
import Person from "./pages/Person";
import Watchlist from "./pages/Watchlist";
import History from "./pages/History";
import { ListsPage, ListDetail, SharedList } from "./pages/Lists";
import Subscription from "./pages/Subscription";
import Notifications from "./pages/Notifications";
import Friends, { UserPage } from "./pages/Friends";
import Settings from "./pages/Settings";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/Overview";
import { Users, Subscriptions, Payments } from "./pages/admin/Tables";
import { Coupons, Reviews, Tools } from "./pages/admin/Manage";

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner className="min-h-screen" />;
  return user ? children ?? <Outlet /> : <Navigate to="/login" replace />;
}
// needs a chosen profile (PIN-protected ones are unlocked on the picker page)
function RequireProfile({ children }) {
  const { active, loaded } = useProfile();
  if (!loaded) return <Spinner className="min-h-screen" />;
  return active ? children ?? <Outlet /> : <Navigate to="/profiles" replace />;
}
function RequireAdmin() { const { user } = useAuth(); return user?.role === "admin" ? <Outlet /> : <Navigate to="/" replace />; }
function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner className="min-h-screen" />;
  return user ? <Navigate to="/profiles" replace /> : children;
}
// "/" is the landing page for visitors and Home for members
function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner className="min-h-screen" />;
  if (!user) return <Landing />;
  return <RequireProfile><Layout><Home /></Layout></RequireProfile>;
}
// links in notifications / emails use short paths
const ToTitle = ({ type }) => { const { id } = useParams(); return <Navigate to={`/title/${type}/${id}`} replace />; };

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/lists/shared/:shareId" element={<SharedList />} />

        <Route element={<RequireAuth />}>
          <Route path="/profiles" element={<ProfilePicker />} />
          <Route path="/profiles/manage" element={<ManageProfiles />} />
          <Route element={<RequireProfile />}>
            <Route element={<Layout />}>
              <Route path="/movies" element={<Browse type="movie" />} />
              <Route path="/series" element={<Browse type="tv" />} />
              <Route path="/search" element={<Search />} />
              <Route path="/title/:mediaType/:id" element={<Details />} />
              <Route path="/movie/:id" element={<ToTitle type="movie" />} />
              <Route path="/tv/:id" element={<ToTitle type="tv" />} />
              <Route path="/person/:id" element={<Person />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/history" element={<History />} />
              <Route path="/lists" element={<ListsPage />} />
              <Route path="/lists/:id" element={<ListDetail />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/u/:username" element={<UserPage />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="users" element={<Users />} />
                  <Route path="subscriptions" element={<Subscriptions />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="coupons" element={<Coupons />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="tools" element={<Tools />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
