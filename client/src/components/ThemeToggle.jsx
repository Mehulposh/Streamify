import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} theme`} title="Toggle theme"
      className={`glass relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl transition hover:scale-105 ${className}`}>
      <Sun size={18} className={`absolute text-amber-500 transition-all duration-500 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon size={18} className={`absolute text-violet-300 transition-all duration-500 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
