// Light social layer: follow people, see friends' (opt-in) activity, share a title with someone.
const router = require("express").Router();
const { User, Follow, Activity, List } = require("../models");
const { z, username, mediaType, tmdbId } = require("../utils/schemas");
const { AppError, asyncHandler, pageOpts, pagination, escapeRegex } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { writeLimiter } = require("../middlewares/security");
const { notify } = require("../utils/notify");
router.use(authenticate);

const byName = async (name) => { const u = await User.findOne({ username: name, isBlocked: false }).select("_id username shareActivity"); if (!u) throw new AppError("User not found", 404); return u; };

router.get("/search", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 20);
  if (q.length < 2) return res.send({ status: true, users: [] });
  const users = await User.find({ username: new RegExp("^" + escapeRegex(q), "i"), isBlocked: false, _id: { $ne: req.user._id } }).select("username").limit(10).lean();
  res.send({ status: true, users: users.map((u) => ({ username: u.username })) });
}));
router.post("/follow/:username", writeLimiter, asyncHandler(async (req, res) => {
  const t = await byName(req.params.username);
  if (String(t._id) === String(req.user._id)) throw new AppError("You cannot follow yourself", 400);
  const r = await Follow.updateOne({ follower: req.user._id, following: t._id }, { $setOnInsert: { follower: req.user._id, following: t._id } }, { upsert: true });
  if (r.upsertedCount) notify(t._id, { type: "new_follower", params: { name: req.user.username }, link: `/u/${req.user.username}` });
  res.send({ status: true, following: true });
}));
router.delete("/follow/:username", asyncHandler(async (req, res) => { const t = await byName(req.params.username); await Follow.deleteOne({ follower: req.user._id, following: t._id }); res.send({ status: true, following: false }); }));
const people = (field, other) => asyncHandler(async (req, res) => {
  const rows = await Follow.find({ [field]: req.user._id }).sort({ createdAt: -1 }).limit(200).populate(other, "username").lean();
  res.send({ status: true, users: rows.map((r) => ({ username: r[other]?.username })).filter((u) => u.username) });
});
router.get("/following", people("follower", "following"));
router.get("/followers", people("following", "follower"));

// Friends' activity, only from people who switched "share my activity" on
router.get("/feed", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 20, 50);
  const ids = (await Follow.find({ follower: req.user._id }).select("following").lean()).map((f) => f.following);
  const users = await User.find({ _id: { $in: ids }, shareActivity: true, isBlocked: false }).select("username").lean();
  const name = Object.fromEntries(users.map((u) => [String(u._id), u.username]));
  const f = { userId: { $in: users.map((u) => u._id) } };
  const [items, total] = await Promise.all([Activity.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Activity.countDocuments(f)]);
  res.send({ status: true, items: items.map((a) => ({ type: a.type, user: name[String(a.userId)], payload: a.payload, at: a.createdAt })), pagination: pagination(p, total) });
}));

router.get("/users/:username", asyncHandler(async (req, res) => {
  const u = await byName(req.params.username);
  const [followers, following, isFollowing, lists] = await Promise.all([Follow.countDocuments({ following: u._id }), Follow.countDocuments({ follower: u._id }),
    Follow.exists({ follower: req.user._id, following: u._id }), List.find({ userId: u._id, isPublic: true }).select("name shareId items").lean()]);
  res.send({ status: true, user: { username: u.username, followers, following, isFollowing: !!isFollowing, sharesActivity: u.shareActivity, publicLists: lists.map((l) => ({ name: l.name, shareId: l.shareId, itemCount: l.items.length })) } });
}));

// "Watch this!" – only between people who follow each other in at least one direction (anti-spam)
router.post("/share", writeLimiter, validate(z.object({ username, tmdbId, mediaType, title: z.string().trim().min(1).max(200), message: z.string().trim().max(200).default("") })), asyncHandler(async (req, res) => {
  const t = await byName(req.body.username);
  const linked = await Follow.exists({ $or: [{ follower: req.user._id, following: t._id }, { follower: t._id, following: req.user._id }] });
  if (!linked) throw new AppError("Follow this person first to share titles with them", 403);
  await notify(t._id, { type: "shared_title", params: { name: req.user.username, title: req.body.title, message: req.body.message }, link: `/${req.body.mediaType}/${req.body.tmdbId}` });
  res.send({ status: true, msg: "Sent!" });
}));
module.exports = router;
