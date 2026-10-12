import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cx } from "../lib/utils";

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((a) => [...a, { id, message, type }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), 4200);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {items.map((t) => {
          const I = Icon[t.type] || Info;
          return (
            <div key={t.id} role="status" className={cx("glass-strong pointer-events-auto flex max-w-sm animate-rise items-start gap-2.5 rounded-2xl px-4 py-3 text-sm",
              t.type === "error" ? "text-rose-600 dark:text-rose-300" : t.type === "info" ? "text-sky-600 dark:text-sky-300" : "text-emerald-600 dark:text-emerald-300")}>
              <I size={18} className="mt-0.5 shrink-0" /> <span className="text-slate-700 dark:text-slate-100">{t.message}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
