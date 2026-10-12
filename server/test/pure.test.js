const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../utils/pure");

test("coupon maths", () => {
  assert.deepEqual(P.priceWithCoupon(199, { type: "percent", value: 20 }), { base: 199, discount: 39.8, amount: 159.2 });
  assert.equal(P.priceWithCoupon(199, { type: "percent", value: 50, maxDiscount: 30 }).discount, 30);
  assert.equal(P.priceWithCoupon(99, { type: "flat", value: 500 }).amount, 0, "discount can never exceed the price");
  assert.equal(P.priceWithCoupon(99, { type: "trial", value: 7 }).discount, 0, "trial coupons never reduce a purchase");
  assert.equal(P.priceWithCoupon(99, null).amount, 99);
});

test("profanity filter uses whole words", () => {
  assert.equal(P.containsProfanity("this movie is shit"), true);
  assert.equal(P.containsProfanity("Scunthorpe classic"), false);
  assert.equal(P.containsProfanity("Great film!"), false);
  assert.equal(P.containsProfanity("such a flurb", ["flurb"]), true, "extra words from env");
});

test("csv escaping and formula-injection guard", () => {
  assert.equal(P.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(P.csvCell("=HYPERLINK(\"x\")").startsWith("\"'="), true);
  assert.equal(P.csvCell("+91 98765"), "'+91 98765");
  assert.equal(P.toCsv([{ a: 1, b: "x" }], ["a", "b"]), "a,b\n1,x");
});

test("TMDB proxy allow-list", () => {
  for (const ok of ["/trending/all/day", "/movie/550", "/movie/550/videos", "/tv/1399/season/2", "/discover/movie", "/search/multi", "/person/287/combined_credits", "/movie/popular", "/configuration"])
    assert.equal(P.isAllowedTmdbPath(ok), true, ok);
  for (const bad of ["/account", "/movie/550/../../account", "/movie/abc", "/authentication/token/new", "//evil.com", "/movie/550/reviews?x=1", "", "/list/1", "/discover/person"])
    assert.equal(P.isAllowedTmdbPath(bad), false, bad);
  assert.equal(P.isGatedTmdbPath("/movie/550/videos"), true);
  assert.equal(P.isGatedTmdbPath("/movie/550"), false);
});

test("TMDB params are whitelisted and mapped", () => {
  const p = P.buildTmdbParams("/discover/movie", { genre: "28,12", year: "2024", minRating: "7.5", sort: "vote_average.desc", page: "2", evil: "1", with_genres: "99", include_adult: "true" }, { language: "hi-IN" });
  assert.equal(p.with_genres, "28,12"); assert.equal(p.primary_release_year, 2024); assert.equal(p["vote_average.gte"], 7.5);
  assert.equal(p.sort_by, "vote_average.desc"); assert.equal(p["vote_count.gte"], 100); assert.equal(p.page, 2);
  assert.equal(p.include_adult, "false", "adult content can never be requested"); assert.equal(p.language, "hi-IN"); assert.equal(p.evil, undefined);
  assert.equal(P.buildTmdbParams("/discover/movie", { genre: "28;DROP" }).with_genres, undefined);
  assert.equal(P.buildTmdbParams("/discover/movie", { sort: "hack.desc" }).sort_by, undefined);
  assert.equal(P.buildTmdbParams("/discover/tv", { year: "2020" }).first_air_date_year, 2020);
  const k = P.buildTmdbParams("/discover/movie", {}, { kids: true });
  assert.equal(k.certification_country, "US"); assert.equal(k["certification.lte"], "PG");
});

test("kids filter", () => {
  const data = { results: [{ id: 1, genre_ids: [16] }, { id: 2, genre_ids: [27] }, { id: 3, adult: true, genre_ids: [] }, { id: 4, media_type: "person" }, { id: 5, genre_ids: [35, 10751] }] };
  assert.deepEqual(P.filterKids(data).results.map((r) => r.id), [1, 5]);
  assert.throws(() => P.filterKids({ id: 9, genres: [{ id: 27 }] }), (e) => e.status === 403);
  assert.throws(() => P.filterKids({ id: 9, adult: true, genres: [] }), (e) => e.status === 403);
  assert.deepEqual(P.filterKids({ id: 9, genres: [{ id: 16 }] }), { id: 9, genres: [{ id: 16 }] });
});

test("genre scoring", () => {
  const top = P.topGenres([{ genre_ids: [28, 12], weight: 3 }, { genre_ids: [28], weight: 2 }, { genre_ids: [35], weight: 1 }], 2);
  assert.deepEqual(top.map((t) => t.id), [28, 12]); assert.equal(top[0].score, 5);
});

test("dates", () => {
  assert.equal(P.addMonths(new Date("2026-01-15T00:00:00Z"), 3).toISOString().slice(0, 10), "2026-04-15");
  assert.equal(P.addDays(new Date("2026-01-30T00:00:00Z"), 3).toISOString().slice(0, 10), "2026-02-02");
});
