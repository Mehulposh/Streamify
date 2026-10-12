import { useEffect } from "react";
import { Loader2, Star, X, Inbox } from "lucide-react";
import { cx, statusLabel } from "../lib/utils";

const VARIANTS = {
  primary: "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30 hover:brightness-110",
  ghost: "glass text-slate-700 hover:bg-white/80 dark:text-slate-100 dark:hover:bg-white/10",
  soft: "bg-fuchsia-500/10 text-fuchsia-600 hover:bg-fuchsia-500/20 dark:text-fuchsia-300",
  danger: "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30 hover:brightness-110",
  success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:brightness-110",
};
const SIZES = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };

export function Button({ variant = "primary", size = "md", loading, className, children, ...p }) {
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 disabled:pointer-events-none disabled:opacity-50", VARIANTS[variant], SIZES[size], className)}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export const Card = ({ className, children, ...p }) => <div {...p} className={cx("glass rounded-3xl p-5 sm:p-6", className)}>{children}</div>;

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }) => <input {...p} className={cx("input", className)} />;
export const Textarea = ({ className, ...p }) => <textarea rows={3} {...p} className={cx("input resize-y", className)} />;
export const Select = ({ className, children, ...p }) => <select {...p} className={cx("input", className)}>{children}</select>;

const TONES = {
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300", rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-300", violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};
export const Badge = ({ tone = "slate", className, children }) => (
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone], className)}>{children}</span>
);
const STATUS_TONE = { pending: "amber", assigned: "sky", "in-progress": "violet", completed: "emerald", cancelled: "slate", disputed: "rose" };
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || "slate"}>{statusLabel(status)}</Badge>;

export const Spinner = ({ className }) => (
  <div className={cx("flex items-center justify-center py-16 text-fuchsia-500", className)}><Loader2 className="animate-spin" size={30} /></div>
);
export const Empty = ({ title = "Nothing here yet", text, action, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center gap-2 py-14 text-center">
    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-500"><Icon size={26} /></div>
    <p className="font-semibold">{title}</p>
    {text && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>}
    {action}
  </div>
);
export const ErrorBox = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300">
    {message} {onRetry && <button className="ml-2 font-semibold underline" onClick={onRetry}>Retry</button>}
  </div>
);

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx("glass-strong animate-rise w-full rounded-3xl p-6", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-slate-500/10"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Stars = ({ value = 0, size = 16, count }) => (
  <span className="inline-flex items-center gap-1">
    <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"} />))}</span>
    {count !== undefined && <span className="text-xs text-slate-500 dark:text-slate-400">{value ? Number(value).toFixed(1) : "New"}{count ? ` (${count})` : ""}</span>}
  </span>
);
export const StarInput = ({ value, onChange }) => (
  <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => (
    <button type="button" key={i} onClick={() => onChange(i)} aria-label={`${i} stars`}>
      <Star size={28} className={cx("transition hover:scale-110", i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600")} />
    </button>))}</div>
);

export const Pagination = ({ pagination, onPage }) =>
  !pagination || pagination.pages <= 1 ? null : (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Button variant="ghost" size="sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</Button>
      <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages}</span>
      <Button variant="ghost" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</Button>
    </div>
  );

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="glass inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1">
    {tabs.map((t) => (
      <button key={t.value} onClick={() => onChange(t.value)}
        className={cx("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition", value === t.value ? "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white shadow" : "text-slate-600 hover:bg-slate-500/10 dark:text-slate-300")}>
        {t.label}
      </button>))}
  </div>
);

export const Stat = ({ icon: Icon, label, value, tone = "fuchsia", sub }) => (
  <Card className="flex items-center gap-4 !p-5">
    <div className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}><Icon size={22} /></div>
    <div className="min-w-0"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate text-2xl font-extrabold">{value}</p>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
  </Card>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
    {action}
  </div>
);

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3">
      <span className={cx("relative h-6 w-11 rounded-full transition", checked ? "bg-gradient-to-r from-rose-500 to-fuchsia-600" : "bg-slate-300 dark:bg-slate-600")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

/** Minimal CSS bar chart: data = [{label, value}] */
export function BarChart({ data, height = 160, format = (v) => v, color = "from-fuchsia-500 to-violet-400" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <Empty title="No data yet" />;
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: height + 40 }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${format(d.value)}`}>
          <span className="text-[10px] font-semibold text-slate-500">{d.value ? format(d.value) : ""}</span>
          <div className={cx("w-full rounded-t-lg bg-gradient-to-t", color)} style={{ height: Math.max(3, (d.value / max) * height) }} />
          <span className="text-[10px] text-slate-500">{d.label}</span>
        </div>))}
    </div>
  );
}
export const HBars = ({ data, format = (v) => v }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">{data.map((d) => (
      <div key={d.label}><div className="mb-1 flex justify-between text-xs"><span className="font-medium">{d.label}</span><span className="text-slate-500">{format(d.value)}</span></div>
        <div className="h-2 rounded-full bg-slate-500/10"><div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-fuchsia-500" style={{ width: `${(d.value / max) * 100}%` }} /></div></div>))}
    </div>
  );
};

import { avatarOf } from "../lib/utils";
export function ProfileAvatar({ profile, size = 48, className }) {
  const [, emoji, grad] = avatarOf(profile?.avatar);
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.5 }} className={cx("grid shrink-0 select-none place-items-center rounded-2xl bg-gradient-to-br shadow-lg", grad, className)} aria-hidden>
      {emoji}
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx("skeleton", className)} />;
