import api, { tmdb } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useGenres } from "../lib/genres";
import Hero from "../components/Hero";
import Row from "../components/Row";
import PosterCard from "../components/PosterCard";

const res = (body) => body.results;

export default function Home() {
  const genres = useGenres();
  const trending = useFetch(() => tmdb("/trending/all/week"), []);
  const cont = useFetch(() => api.get("/history/continue"), []);
  const recs = useFetch(() => api.get("/recommendations"), []);
  const popular = useFetch(() => tmdb("/movie/popular"), []);
  const topMovies = useFetch(() => tmdb("/movie/top_rated"), []);
  const series = useFetch(() => tmdb("/tv/popular"), []);
  const upcoming = useFetch(() => tmdb("/movie/upcoming"), []);

  return (
    <div className="space-y-8">
      <Hero items={trending.loading ? null : trending.data ? res(trending.data) : []} genres={genres} />
      <Row title="Continue watching" items={cont.data?.items} loading={cont.loading}
        renderItem={(h) => <PosterCard key={`${h.mediaType}-${h.tmdbId}`} item={{ ...h, id: h.tmdbId }} type={h.mediaType} progress={h.percent} />} />
      {(recs.data?.rows || []).map((r) => <Row key={r.title} title={r.title} items={r.items} />)}
      <Row title="Trending this week" items={trending.data && res(trending.data)} loading={trending.loading} />
      <Row title="Popular movies" items={popular.data && res(popular.data)} loading={popular.loading} type="movie" />
      <Row title="Binge-worthy series" items={series.data && res(series.data)} loading={series.loading} type="tv" />
      <Row title="Top rated" items={topMovies.data && res(topMovies.data)} loading={topMovies.loading} type="movie" />
      <Row title="Coming soon" items={upcoming.data && res(upcoming.data)} loading={upcoming.loading} type="movie" />
    </div>
  );
}
