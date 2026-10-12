import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { profileStore } from "../lib/api";
import { useAuth } from "./AuthContext";

const Ctx = createContext(null);
export const useProfile = () => useContext(Ctx);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [active, setActive] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/profiles");
      setProfiles(data.profiles);
      const saved = profileStore.get(), p = data.profiles.find((x) => x._id === saved?.id);
      setActive(p && (!p.hasPin || saved?.token) ? p : null); // a PIN profile needs its unlock token
      if (!p) profileStore.clear();
    } catch { setProfiles([]); setActive(null); } finally { setLoaded(true); }
  }, []);
  useEffect(() => { if (user) load(); else { setProfiles([]); setActive(null); setLoaded(false); } }, [user, load]);
  useEffect(() => {
    const h = () => { setActive(null); profileStore.clear(); };
    window.addEventListener("profile:locked", h);
    return () => window.removeEventListener("profile:locked", h);
  }, []);

  /** Select a profile; PIN-protected ones require the 4-digit PIN (server returns a 12h unlock token). */
  const select = async (p, pin) => {
    let token = null;
    if (p.hasPin) { const { data } = await api.post(`/profiles/${p._id}/unlock`, { pin }); token = data.profileToken; }
    profileStore.set({ id: p._id, token });
    setActive(p);
  };
  const leave = () => { profileStore.clear(); setActive(null); };
  return <Ctx.Provider value={{ profiles, active, loaded, load, select, leave }}>{children}</Ctx.Provider>;
}
