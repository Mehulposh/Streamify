// Prices live ONLY on the server (the old code trusted nothing but still duplicated them in the client).
const PLANS = {
  "1month":  { name: "1 Month",  price: 99,  months: 1 },
  "3months": { name: "3 Months", price: 199, months: 3 },
  "6months": { name: "6 Months", price: 399, months: 6 },
  "1year":   { name: "1 Year",   price: 699, months: 12 },
};
const MAX_PROFILES = 5;
// TMDB genre ids hidden from kids profiles: Horror, Thriller, Crime, War (+ TV War & Politics)
const KIDS_BLOCKED_GENRES = [27, 53, 80, 10752, 10768];
const COMPLETE_THRESHOLD = 0.92; // watched >= 92% counts as finished
module.exports = { PLANS, MAX_PROFILES, KIDS_BLOCKED_GENRES, COMPLETE_THRESHOLD };
