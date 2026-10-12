import { useCallback, useEffect, useRef, useState } from "react";
import { errMsg } from "./api";

/** useFetch(() => api.get(...), [deps]) -> { data, loading, error, reload, setData } */
export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const r = await fnRef.current(); setData(r.data); setError(""); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, loading, error, reload: run, setData };
}

export function useInterval(cb, ms) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => { const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms]);
}

export function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
