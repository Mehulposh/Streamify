// One-off migration of data created by the OLD backend. Safe to re-run:  npm run migrate
const crypto = require("crypto");
const mongoose = require("mongoose");
const env = require("../config/env");
const M = require("../models");
const { expireStale } = require("../services/billing");

(async () => {
  await mongoose.connect(env.mongoUri);
  // 1. emails lowercase (report duplicates, never merge accounts)
  const seen = new Map();
  for (const u of await M.User.find().select("email").lean()) {
    const e = String(u.email).trim().toLowerCase();
    if (seen.has(e)) { console.warn(`DUPLICATE email after lowercasing: ${e} (${seen.get(e)} and ${u._id}) – resolve manually`); continue; }
    seen.set(e, u._id);
    if (e !== u.email) await M.User.collection.updateOne({ _id: u._id }, { $set: { email: e } });
  }
  // 2. flags, referral codes
  await M.User.collection.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  for (const u of await M.User.find({ referralCode: { $exists: false } }).select("_id").lean())
    await M.User.collection.updateOne({ _id: u._id }, { $set: { referralCode: crypto.randomBytes(4).toString("hex").toUpperCase() } });
  // 3. default profile per user + attach old watchlist rows to it
  let profiles = 0, movies = 0;
  for (const u of await M.User.find().select("username").lean()) {
    let p = await M.Profile.findOne({ userId: u._id }).sort({ createdAt: 1 });
    if (!p) { p = await M.Profile.create({ userId: u._id, name: u.username.slice(0, 30) }); profiles++; }
    movies += (await M.Movie.collection.updateMany({ userId: String(u._id), profileId: { $exists: false } }, { $set: { profileId: p._id } })).modifiedCount;
  }
  // 4. reviews
  for (const r of await M.Review.collection.find({ $or: [{ mediaType: { $exists: false } }, { status: { $exists: false } }] }).toArray())
    await M.Review.collection.updateOne({ _id: r._id }, { $set: { mediaType: r.mediaType || "movie", status: r.status || "visible", helpfulBy: r.helpfulBy || [], reports: r.reports || [] } });
  // 5. subscriptions: at most one active per user (keep the one ending last), then expire stale ones
  const act = await M.Subscription.find({ status: "active" }).sort({ endDate: -1 });
  const keep = new Set();
  for (const s of act) { if (keep.has(String(s.user))) { s.status = "expired"; await s.save(); } else keep.add(String(s.user)); }
  console.log(`Expired ${await expireStale()} subscription(s) past their end date`);
  // 6. indexes
  for (const m of Object.values(M)) { try { await m.syncIndexes(); } catch (e) { console.warn(`Index sync failed for ${m.modelName}: ${e.message}`); } }
  // 7. admin audit – the old API let anyone register as admin
  const admins = await M.User.find({ role: "admin" }).select("username email createdAt").lean();
  console.log(`Created ${profiles} profile(s), attached ${movies} watchlist item(s).`);
  console.warn(`\nSECURITY: review these ${admins.length} admin account(s) – the old registration accepted role=admin from anyone:`);
  admins.forEach((a) => console.warn(`  ${a.username} <${a.email}> created ${a.createdAt?.toISOString?.() || "?"}`));
  console.warn('\nAlso: old tokens were signed with the secret "SSC" and are now invalid (everyone must log in again). Rotate the MongoDB / TMDB secrets that were in the shared zip.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
