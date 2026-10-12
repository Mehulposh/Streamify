// Hourly housekeeping (single-instance). If you run several instances, run this from ONE of them (or a cron job).
const { Subscription, Movie, Payment, WatchTime, Notification } = require("../models");
const { expireStale, applyPaid } = require("../services/billing");
const { notify } = require("../utils/notify");
const { dayStr, addDays } = require("../utils/pure");

async function remindExpiring() {
  const soon = await Subscription.find({ status: "active", expiryReminderSent: false, endDate: { $gt: new Date(), $lte: addDays(new Date(), 3) } }).limit(500);
  for (const s of soon) { await notify(s.user, { type: "subscription_expiring", params: { date: s.endDate.toDateString() }, link: "/subscription", email: true }); s.expiryReminderSent = true; await s.save(); }
  return soon.length;
}
async function releaseReminders() { // watchlist titles releasing within 3 days
  const list = await Movie.find({ releaseNotified: false, release_date: { $gte: dayStr(), $lte: dayStr(addDays(new Date(), 3)) } }).limit(500);
  for (const m of list) { await notify(m.userId, { type: "release_soon", params: { title: m.title, date: m.release_date }, link: `/${m.mediaType}/${m.id}` }); m.releaseNotified = true; await m.save(); }
  return list.length;
}
// A payment that was marked paid but whose plan was never applied (crash between the two steps) gets applied now.
async function reconcilePaid() {
  const paid = await Payment.find({ status: "paid", paidAt: { $lt: new Date(Date.now() - 120e3), $gt: addDays(new Date(), -7) } }).limit(200);
  let n = 0;
  for (const p of paid) if (!(await Subscription.exists({ paymentIds: p._id }))) { await applyPaid(p); n++; }
  return n;
}
async function purge() {
  await WatchTime.deleteMany({ date: { $lt: dayStr(addDays(new Date(), -60)) } });
  await Notification.deleteMany({ createdAt: { $lt: addDays(new Date(), -180) }, read: true });
}
async function runOnce() {
  const out = {};
  for (const [k, fn] of Object.entries({ expired: expireStale, reminded: remindExpiring, releases: releaseReminders, reconciled: reconcilePaid, purge })) {
    try { out[k] = await fn(); } catch (e) { console.error(`[scheduler] ${k} failed:`, e.message); }
  }
  return out;
}
function start() {
  setTimeout(runOnce, 30e3).unref();
  setInterval(runOnce, 3600e3).unref();
}
module.exports = { start, runOnce };
