const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { Profile } = require("../models");
const { z, objectId, bool } = require("../utils/schemas");
const { MAX_PROFILES } = require("../utils/constants");
const { AppError, asyncHandler } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { profileToken } = require("../middlewares/profile");
const { deleteProfileData, todaySeconds } = require("../services/misc");
router.use(authenticate);

const pin = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
const base = { name: z.string().trim().min(1).max(30), avatar: z.string().trim().max(40), isKids: bool, language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/), dailyLimitMinutes: z.number().int().min(0).max(1440) };
const createSchema = z.object({ ...base, avatar: base.avatar.optional(), isKids: base.isKids.optional(), language: base.language.optional(), dailyLimitMinutes: base.dailyLimitMinutes.optional(), pin: pin.optional() });
const patchSchema = z.object({ ...base, pin: pin.nullable(), currentPin: pin }).partial();
const idParam = validate(z.object({ id: objectId }), "params");

router.get("/", asyncHandler(async (req, res) => res.send({ status: true, profiles: await Profile.find({ userId: req.user._id }).sort({ createdAt: 1 }), max: MAX_PROFILES })));

router.post("/", validate(createSchema), asyncHandler(async (req, res) => {
  if ((await Profile.countDocuments({ userId: req.user._id })) >= MAX_PROFILES) throw new AppError(`You can have at most ${MAX_PROFILES} profiles`, 400);
  const { pin: p, ...rest } = req.body;
  const profile = await Profile.create({ ...rest, userId: req.user._id, pinHash: p ? await bcrypt.hash(p, 10) : undefined, hasPin: !!p });
  res.status(201).send({ status: true, profile });
}));

router.patch("/:id", idParam, validate(patchSchema), asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id }).select("+pinHash");
  if (!profile) throw new AppError("Profile not found", 404);
  const { pin: p, currentPin, ...rest } = req.body;
  if (profile.pinHash && !(currentPin && (await bcrypt.compare(currentPin, profile.pinHash)))) throw new AppError("Enter the current PIN to change this profile", 403, "PIN_REQUIRED");
  Object.assign(profile, rest);
  if (p === null) { profile.pinHash = undefined; profile.hasPin = false; }
  else if (p) { profile.pinHash = await bcrypt.hash(p, 10); profile.hasPin = true; }
  await profile.save();
  res.send({ status: true, profile });
}));

router.delete("/:id", idParam, validate(z.object({ pin: pin.optional() })), asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id }).select("+pinHash");
  if (!profile) throw new AppError("Profile not found", 404);
  if ((await Profile.countDocuments({ userId: req.user._id })) <= 1) throw new AppError("You cannot delete your last profile", 400);
  if (profile.pinHash && !(req.body.pin && (await bcrypt.compare(req.body.pin, profile.pinHash)))) throw new AppError("PIN required to delete this profile", 403, "PIN_REQUIRED");
  await deleteProfileData(profile._id); await profile.deleteOne();
  res.send({ status: true, msg: "Profile deleted" });
}));

// PIN gate: returns a 12h token to send as x-profile-token together with x-profile-id
router.post("/:id/unlock", authLimiter, idParam, validate(z.object({ pin: pin })), asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id }).select("+pinHash");
  if (!profile) throw new AppError("Profile not found", 404);
  if (!profile.pinHash) return res.send({ status: true, profile, profileToken: null });
  if (!(await bcrypt.compare(req.body.pin, profile.pinHash))) throw new AppError("Wrong PIN", 403, "WRONG_PIN");
  profile.pinHash = undefined;
  res.send({ status: true, profile, profileToken: profileToken(req.user._id, profile._id) });
}));

router.get("/:id/watch-time", idParam, asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
  if (!profile) throw new AppError("Profile not found", 404);
  const used = await todaySeconds(profile._id);
  res.send({ status: true, usedSeconds: used, limitMinutes: profile.dailyLimitMinutes, remainingSeconds: profile.dailyLimitMinutes ? Math.max(0, profile.dailyLimitMinutes * 60 - used) : null });
}));
module.exports = router;
