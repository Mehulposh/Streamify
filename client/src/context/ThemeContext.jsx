import { createContext, useContext, useEffect, useState } from "react";
const Ctx = createContext({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(Ctx);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("st-theme", theme); } catch { /* private mode */ }
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</Ctx.Provider>;
}
