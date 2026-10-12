import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { profileStore } from "../lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { const { data } = await api.get("/auth/me"); setUser(data.user); setAccess(data.access); return data.user; }
    catch { setUser(null); setAccess(null); return null; }
    finally { setReady(true); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => { setUser(null); setAccess(null); };
    window.addEventListener("auth:expired", h);
    return () => window.removeEventListener("auth:expired", h);
  }, []);

  // Backend answers HTTP 200 + {status:false,msg} for bad credentials / duplicates
  const authCall = async (url, body) => {
    const { data } = await api.post(url, body);
    if (!data.status) throw new Error(data.msg || "Request failed");
    return refresh();
  };
  const login = (email, password) => authCall("/auth/login", { email, password });
  const register = (body) => authCall("/auth/register", body);
  const google = (idToken) => authCall("/auth/google", { idToken });
  const logout = async () => { try { await api.post("/auth/logout"); } finally { profileStore.clear(); setUser(null); setAccess(null); } };

  return <Ctx.Provider value={{ user, access, ready, login, register, google, logout, refresh }}>{children}</Ctx.Provider>;
}
