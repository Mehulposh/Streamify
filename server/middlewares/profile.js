const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { Profile } = require("../models");
const { AppError, asyncHandler } = require("../utils/helpers");

const profileToken = (userId, profileId) => jwt.sign({ t: "profile", uid: String(userId), pid: String(profileId) }, env.jwtSecret, { expiresIn: "12h" });

/** Picks the active profile from the x-profile-id header (default: the user's first profile).
 *  PIN-protected profiles additionally need the x-profile-token returned by POST /api/profiles/:id/unlock. */
const withProfile = asyncHandler(async (req, res, next) => {
  const id = req.get("x-profile-id");
  let profile;
  if (id) {
    if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError("Invalid profile id", 400);
    profile = await Profile.findOne({ _id: id, userId: req.user._id }).select("+pinHash");
    if (!profile) throw new AppError("Profile not found", 404);
  } else {
    profile = await Profile.findOne({ userId: req.user._id }).sort({ createdAt: 1 }).select("+pinHash");
    if (!profile) profile = await Profile.create({ userId: req.user._id, name: req.user.username.slice(0, 30) });
  }
  if (profile.pinHash) {
    try {
      const d = jwt.verify(req.get("x-profile-token") || "", env.jwtSecret);
      if (d.t !== "profile" || d.pid !== String(profile._id) || d.uid !== String(req.user._id)) throw new Error("mismatch");
    } catch { throw new AppError("This profile is locked. Enter its PIN.", 403, "PROFILE_LOCKED"); }
  }
  profile.pinHash = undefined;
  req.profile = profile;
  next();
});
module.exports = { withProfile, profileToken };
