const { Activity, Movie, Review, Rating, History, List, SearchHistory, WatchTime, Notification, Follow, Profile, User, Subscription } = require("../models");
const { dayStr } = require("../utils/pure");

// ---- recommendation cache (per profile, 30 min) ----
const recs = new Map();
const recsCache = {
  get: (id) => { const h = recs.get(String(id)); return h && h.exp > Date.now() ? h.data : null; },
  set: (id, data) => { recs.set(String(id), { exp: Date.now() + 30 * 60e3, data }); if (recs.size > 2000) recs.delete(recs.keys().next().value); },
  invalidate: (id) => recs.delete(String(id)),
};

/** Friends only see activity if the user opted in (User.shareActivity). */
const logActivity = (user, type, payload) =>
  user.shareActivity ? Activity.create({ userId: user._id, type, payload }).catch(() => {}) : Promise.resolve();

// ---- daily watch-time limit (parental control) ----
async function todaySeconds(profileId) { return (await WatchTime.findOne({ profileId, date: dayStr() }).lean())?.seconds || 0; }
async function limitReached(profile) {
  if (!profile.dailyLimitMinutes) return false;
  return (await todaySeconds(profile._id)) >= profile.dailyLimitMinutes * 60;
}

// ---- cascade deletes ----
async function deleteProfileData(profileId) {
  await Promise.all([Movie.deleteMany({ profileId }), History.deleteMany({ profileId }), Rating.deleteMany({ profileId }), List.deleteMany({ profileId }), SearchHistory.deleteMany({ profileId }), WatchTime.deleteMany({ profileId })]);
  recsCache.invalidate(profileId);
}
/** Removes a user and everything personal. Payments are kept (financial records); subscriptions are cancelled. */
async function deleteUserData(userId) {
  const profiles = await Profile.find({ userId }).select("_id").lean();
  for (const p of profiles) await deleteProfileData(p._id);
  const uid = String(userId);
  await Promise.all([
    Profile.deleteMany({ userId }), Review.deleteMany({ userId: uid }), Movie.deleteMany({ userId: uid }), Notification.deleteMany({ userId }),
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }), Activity.deleteMany({ userId }),
    Subscription.updateMany({ user: userId, status: "active" }, { status: "cancelled", endDate: new Date() }),
  ]);
  await User.deleteOne({ _id: userId });
}
module.exports = { recsCache, logActivity, todaySeconds, limitReached, deleteProfileData, deleteUserData };
