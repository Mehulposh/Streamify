const router = require("express").Router();
const { Notification } = require("../models");
const { asyncHandler, pageOpts, pagination } = require("../utils/helpers");
const { authenticate } = require("../middlewares/auth");
router.use(authenticate);
router.get("/", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 20, 100), f = { userId: req.user._id };
  if (req.query.unread === "true") f.read = false;
  const [items, total, unread] = await Promise.all([Notification.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Notification.countDocuments(f), Notification.countDocuments({ userId: req.user._id, read: false })]);
  res.send({ status: true, notifications: items, unread, pagination: pagination(p, total) });
}));
router.get("/unread-count", asyncHandler(async (req, res) => res.send({ status: true, unread: await Notification.countDocuments({ userId: req.user._id, read: false }) })));
router.post("/read-all", asyncHandler(async (req, res) => { await Notification.updateMany({ userId: req.user._id, read: false }, { read: true }); res.send({ status: true }); }));
router.post("/:id/read", asyncHandler(async (req, res) => { await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { read: true }); res.send({ status: true }); }));
router.delete("/:id", asyncHandler(async (req, res) => { await Notification.deleteOne({ _id: req.params.id, userId: req.user._id }); res.send({ status: true }); }));
module.exports = router;
