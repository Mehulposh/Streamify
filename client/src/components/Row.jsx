import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PosterCard from "./PosterCard";
import { Skeleton } from "./ui";
import { typeOf } from "../lib/utils";

/** Horizontal carousel with snap scrolling and hover arrows. */
export default function Row({ title, items, type, loading, renderItem, action }) {
  const ref = useRef();
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  if (!loading && !items?.length) return null;
  return (
    <section className="group/row relative animate-rise">
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>{action}
      </div>
      <div className="relative">
        <button aria-label="Scroll left" onClick={() => scroll(-1)} className="glass absolute -left-3 top-[40%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full opacity-0 transition group-hover/row:opacity-100 md:grid"><ChevronLeft size={20} /></button>
        <div ref={ref} className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto scroll-smooth px-1 pb-3 pt-2 sm:gap-4">
          {loading ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] w-[140px] shrink-0 sm:w-[170px]" />)
            : items.map((it) => (renderItem ? renderItem(it) : <PosterCard key={`${typeOf(it, type)}-${it.id ?? it.tmdbId}`} item={it} type={type || typeOf(it)} />))}
        </div>
        <button aria-label="Scroll right" onClick={() => scroll(1)} className="glass absolute -right-3 top-[40%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full opacity-0 transition group-hover/row:opacity-100 md:grid"><ChevronRight size={20} /></button>
      </div>
    </section>
  );
}
