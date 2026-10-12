// Custom lists / collections ("Weekend picks"), shareable via a public link.
const router = require("express").Router();
const crypto = require("crypto");
const { List, User } = require("../models");
const { z, mediaType, tmdbId, bool } = require("../utils/schemas");
const { AppError, asyncHandler } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { withProfile } = require("../middlewares/profile");
const { writeLimiter } = require("../middlewares/security");
const { logActivity } = require("../services/misc");

const MAX_LISTS = 50, MAX_ITEMS = 500;
const itemSchema = z.object({ tmdbId, mediaType, title: z.string().trim().min(1).max(200), poster_path: z.string().max(200).nullish(), vote_average: z.number().min(0).max(10).optional() });
const out = (l, withShare = true) => { const o = l.toObject ? l.toObject() : l; if (!o.isPublic || !withShare) delete o.shareId; return o; };

// public, no login: https://app/lists/<shareId>
router.get("/shared/:shareId", asyncHandler(async (req, res) => {
  if (!/^[\w-]{6,40}$/.test(req.params.shareId)) throw new AppError("List not found", 404);
  const l = await List.findOne({ shareId: req.params.shareId, isPublic: true }).lean();
  if (!l) throw new AppError("List not found", 404);
  const owner = await User.findById(l.userId).select("username").lean();
  res.send({ status: true, list: { name: l.name, description: l.description, items: l.items, owner: owner?.username, updatedAt: l.updatedAt } });
}));

router.use(authenticate, withProfile);
router.get("/", asyncHandler(async (req, res) => {
  const lists = await List.find({ profileId: req.profile._id }).sort({ updatedAt: -1 }).lean();
  res.send({ status: true, lists: lists.map((l) => ({ ...out(l), itemCount: l.items.length, items: l.items.slice(0, 4) })) });
}));
router.post("/", writeLimiter, validate(z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(300).optional(), isPublic: bool.optional() })), asyncHandler(async (req, res) => {
  if ((await List.countDocuments({ profileId: req.profile._id })) >= MAX_LISTS) throw new AppError(`Maximum ${MAX_LISTS} lists`, 400);
  const l = await List.create({ ...req.body, userId: req.user._id, profileId: req.profile._id, shareId: crypto.randomBytes(9).toString("base64url") });
  if (l.isPublic) logActivity(req.user, "list", { name: l.name, shareId: l.shareId });
  res.status(201).send({ status: true, list: out(l) });
}));
const mine = async (req) => { const l = await List.findOne({ _id: req.params.id, profileId: req.profile._id }); if (!l) throw new AppError("List not found", 404); return l; };
router.get("/:id", asyncHandler(async (req, res) => res.send({ status: true, list: out(await mine(req)) })));
router.patch("/:id", validate(z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(300), isPublic: bool }).partial()), asyncHandler(async (req, res) => {
  const l = await mine(req); Object.assign(l, req.body); await l.save(); res.send({ status: true, list: out(l) });
}));
router.delete("/:id", asyncHandler(async (req, res) => { await (await mine(req)).deleteOne(); res.send({ status: true }); }));
router.post("/:id/items", writeLimiter, validate(itemSchema), asyncHandler(async (req, res) => {
  const l = await mine(req);
  if (l.items.some((i) => i.tmdbId === req.body.tmdbId && i.mediaType === req.body.mediaType)) throw new AppError("Already in this list", 409);
  if (l.items.length >= MAX_ITEMS) throw new AppError(`Maximum ${MAX_ITEMS} titles per list`, 400);
  l.items.push({ ...req.body, poster_path: req.body.poster_path || undefined }); await l.save();
  res.status(201).send({ status: true, list: out(l) });
}));
router.delete("/:id/items/:mediaType/:tmdbId", asyncHandler(async (req, res) => {
  const l = await mine(req);
  l.items = l.items.filter((i) => !(i.mediaType === req.params.mediaType && i.tmdbId === parseInt(req.params.tmdbId, 10))); await l.save();
  res.send({ status: true, list: out(l) });
}));
module.exports = router;
