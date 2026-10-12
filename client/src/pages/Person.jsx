import { useState } from "react";
import { useParams } from "react-router-dom";
import { User } from "lucide-react";
import { img, tmdb } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Button, ErrorBox, Spinner } from "../components/ui";
import PosterCard from "../components/PosterCard";
import { fmtDate } from "../lib/utils";

export default function Person() {
  const { id } = useParams(); const [more, setMore] = useState(false);
  const p = useFetch(() => tmdb(`/person/${id}`), [id]);
  const c = useFetch(() => tmdb(`/person/${id}/combined_credits`), [id]);
  if (p.loading) return <Spinner />;
  if (p.error) return <ErrorBox message={p.error} />;
  const x = p.data, seen = new Set();
  const credits = (c.data?.cast || []).filter((m) => m.poster_path && ["movie", "tv"].includes(m.media_type) && !seen.has(`${m.media_type}${m.id}`) && seen.add(`${m.media_type}${m.id}`)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return (
    <div className="animate-fade">
      <div className="glass mb-8 flex flex-col gap-6 rounded-3xl p-6 sm:flex-row">
        {x.profile_path ? <img src={img(x.profile_path, "w342")} alt={x.name} className="mx-auto h-64 w-44 rounded-2xl object-cover shadow-xl sm:mx-0" /> : <div className="grid h-64 w-44 place-items-center rounded-2xl bg-fuchsia-500/20"><User size={40} /></div>}
        <div className="min-w-0 flex-1"><h1 className="text-3xl font-black">{x.name}</h1>
          <p className="mt-1 text-sm opacity-70">{[x.known_for_department, x.birthday && `Born ${fmtDate(x.birthday)}`, x.place_of_birth].filter(Boolean).join(" · ")}</p>
          {x.biography && <><p className={`mt-4 whitespace-pre-line text-sm opacity-90 ${more ? "" : "line-clamp-6"}`}>{x.biography}</p><Button variant="soft" size="sm" className="mt-2" onClick={() => setMore(!more)}>{more ? "Show less" : "Read more"}</Button></>}</div>
      </div>
      <h2 className="mb-4 text-lg font-extrabold">Known for</h2>
      {c.loading ? <Spinner /> : <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">{credits.slice(0, 32).map((m) => <PosterCard key={`${m.media_type}${m.id}`} item={m} type={m.media_type} className="w-full" />)}</div>}
    </div>
  );
}
