import { useEffect, useState } from "react";
import { tmdb } from "./api";

let cache = null;
/** id -> name map for movie + tv genres (cached for the session). */
export function useGenres() {
  const [g, setG] = useState(cache || {});
  useEffect(() => {
    if (cache) return;
    Promise.all([tmdb("/genre/movie/list"), tmdb("/genre/tv/list")]).then(([m, t]) => {
      cache = Object.fromEntries([...m.data.genres, ...t.data.genres].map((x) => [x.id, x.name])); setG(cache);
    }).catch(() => {});
  }, []);
  return g;
}
export const genreList = async (type) => (await tmdb(`/genre/${type}/list`)).data.genres;
