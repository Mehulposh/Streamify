import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { errMsg } from "../lib/api";
import { useProfile } from "./ProfileContext";
import { useToast } from "./ToastContext";

const Ctx = createContext(null);
export const useWatchlist = () => useContext(Ctx);

/** One shared copy of the active profile's watchlist so every card can show / toggle its saved state. */
export function WatchlistProvider({ children }) {
  const { active } = useProfile();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/saved/getmovies", { params: { limit: 500 } }); setItems(data.movies || []); } catch { setItems([]); } finally { setReady(true); }
  }, []);
  useEffect(() => { if (active) load(); else { setItems([]); setReady(false); } }, [active, load]);

  const find = (type, id) => items.find((m) => m.mediaType === type && m.id === id);
  const toggle = async (t) => { // t = {id, mediaType, title, poster_path, genre_ids, release_date, vote_average}
    try {
      if (find(t.mediaType, t.id)) {
        await api.delete(`/saved/deletemovie/${t.id}`, { params: { mediaType: t.mediaType } });
        setItems((a) => a.filter((m) => !(m.mediaType === t.mediaType && m.id === t.id))); toast("Removed from your watchlist", "info");
      } else {
        const { data } = await api.post("/saved/addmovie", t);
        if (!data.status) return toast(data.msg, "info");
        await load(); toast("Saved to your watchlist");
      }
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const setWatched = async (m, watched) => {
    try { await api.put(`/saved/watch/${m.id}`, { watched }, { params: { mediaType: m.mediaType } }); setItems((a) => a.map((x) => (x.saveId === m.saveId ? { ...x, watched } : x))); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  return <Ctx.Provider value={{ items, ready, has: (t, i) => !!find(t, i), find, toggle, setWatched, reload: load }}>{children}</Ctx.Provider>;
}
