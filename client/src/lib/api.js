import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", withCredentials: true });

// Active profile (sent as headers on every request; PIN-protected profiles also carry an unlock token)
export const profileStore = {
  get() { try { return JSON.parse(localStorage.getItem("st-profile") || "null"); } catch { return null; } },
  set(p) { try { localStorage.setItem("st-profile", JSON.stringify(p)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem("st-profile"); } catch { /* ignore */ } },
};
const emit = (name) => window.dispatchEvent(new Event(name));

api.interceptors.request.use((cfg) => {
  const p = profileStore.get();
  if (p?.id) { cfg.headers["x-profile-id"] = p.id; if (p.token) cfg.headers["x-profile-token"] = p.token; }
  return cfg;
});
api.interceptors.response.use((r) => r, (err) => {
  const s = err.response?.status, code = err.response?.data?.code, url = err.config?.url || "";
  if (s === 401 && !/\/auth\/(login|me|register|google)/.test(url)) emit("auth:expired");
  if (s === 402 || code === "SUBSCRIPTION_REQUIRED") emit("paywall");
  if (code === "PROFILE_LOCKED") emit("profile:locked");
  return Promise.reject(err);
});

export const errMsg = (e) => e?.response?.data?.msg || e?.response?.data?.message || e?.message || "Something went wrong";
export const tmdb = (path, params) => api.get(`/tmdb${path}`, { params });           // catalogue goes through our server
export const img = (path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "");
export default api;
