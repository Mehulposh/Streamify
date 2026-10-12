import { useEffect, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../context/ToastContext";
import { mmss } from "../lib/utils";

const BEAT = 15; // seconds between progress heartbeats

/** Trailer player with the full server-side loop: playback/start (paywall + daily limit) -> heartbeats -> continue-watching.
 *  Swap the iframe for your own <video> source later; the heartbeat logic stays the same. */
export default function Player({ item, videoKey, start, durationSeconds, trialRemaining, onClose }) {
  const toast = useToast();
  const startAt = start?.progressSeconds || 0;
  const [elapsed, setElapsed] = useState(0);
  const [left, setLeft] = useState(trialRemaining ?? null);
  const sent = useRef(0), elapsedRef = useRef(0), closed = useRef(false);

  const beat = async (final = false) => {
    const delta = Math.min(600, Math.round(elapsedRef.current - sent.current));
    if (delta <= 0 && !final) return;
    sent.current += delta;
    try {
      const { data } = await api.put("/history", { tmdbId: item.id, mediaType: item.mediaType, title: item.title, poster_path: item.poster_path, backdrop_path: item.backdrop_path || null,
        genre_ids: item.genre_ids || [], progressSeconds: Math.min(startAt + elapsedRef.current, 86400), durationSeconds: durationSeconds || 0, deltaSeconds: Math.max(0, delta) });
      if (data.limitReached && !closed.current) { toast("Daily watch limit reached for this profile", "info"); onClose(); }
    } catch (e) { if (!closed.current && [402, 403].includes(e.response?.status)) { if (e.response?.data?.code === "DAILY_LIMIT") toast("Daily watch limit reached for this profile", "info"); onClose(); } }
  };

  useEffect(() => {
    const t = setInterval(() => {
      elapsedRef.current += 1; setElapsed(elapsedRef.current);
      setLeft((l) => (l == null ? l : Math.max(0, l - 1)));
      if (elapsedRef.current % BEAT === 0) beat();
    }, 1000);
    return () => { clearInterval(t); closed.current = true; beat(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (left === 0) { toast("Your free trial has ended", "info"); window.dispatchEvent(new Event("paywall")); onClose(); } }, [left]); // eslint-disable-line
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-3 backdrop-blur-md animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between text-white">
          <div className="min-w-0"><p className="truncate font-bold">{item.title}</p>
            <p className="text-xs text-white/60">Trailer player · {startAt > 10 ? `resumes at ${mmss(startAt)} · ` : ""}watched {mmss(elapsed)}</p></div>
          <div className="flex items-center gap-3">
            {left != null && <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"><Clock size={13} /> Free trial {mmss(left)}</span>}
            <button onClick={onClose} aria-label="Close player" className="glass grid h-10 w-10 place-items-center rounded-full text-white"><X size={18} /></button>
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
          {videoKey ? <iframe title={item.title} className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            : <div className="grid h-full place-items-center text-white/70">No video is available for this title yet.</div>}
        </div>
      </div>
    </div>
  );
}
