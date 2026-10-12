const router = require("express").Router();
const env = require("../config/env");
const { Payment, User, Subscription } = require("../models");
const { z } = require("../utils/schemas");
const { PLANS } = require("../utils/constants");
const { priceWithCoupon } = require("../utils/pure");
const { AppError, asyncHandler, escHtml } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, requireVerified } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { finalizePayment } = require("../services/billing");
const { findCoupon } = require("../services/coupons");
const rzp = require("../utils/razorpay");

/** Price is computed on the server from PLANS; the client only says which plan. */
async function createOrder(user, planId, couponCode) {
  const plan = PLANS[planId];
  if (!plan) throw new AppError("Invalid plan", 400);
  const coupon = couponCode ? await findCoupon(couponCode, user._id, { plan: planId, types: ["percent", "flat"] }) : null;
  const p = priceWithCoupon(plan.price, coupon);
  await Payment.deleteMany({ userId: user._id, status: "created" }); // drop abandoned attempts
  const base = { userId: user._id, plan: planId, baseAmount: p.base, discount: p.discount, amount: p.amount, couponCode: coupon?.code };
  if (p.amount === 0) { // 100% coupon
    const pay = await Payment.create({ ...base, mode: "free" });
    const r = await finalizePayment({ _id: pay._id });
    return { activated: true, payment: r.pay, subscription: r.sub };
  }
  if (env.paymentMode === "disabled") throw new AppError("Payments are not enabled on this server", 501);
  const pay = await Payment.create({ ...base, mode: env.paymentMode });
  if (env.paymentMode === "mock") { pay.razorpayOrderId = `mock_${pay._id}`; await pay.save(); return { payment: pay, order: { mock: true, orderId: pay.razorpayOrderId, amount: Math.round(p.amount * 100), currency: "INR" } }; }
  const o = await rzp.createOrder({ amountPaise: Math.round(p.amount * 100), receipt: String(pay._id), notes: { plan: planId } });
  pay.razorpayOrderId = o.id; await pay.save();
  return { payment: pay, order: { keyId: env.razorpay.keyId, orderId: o.id, amount: o.amount, currency: o.currency } };
}

// Webhook: no login, authenticated by HMAC signature (needs the raw body captured in index.js)
router.post("/webhook", asyncHandler(async (req, res) => {
  if (!rzp.verifyWebhook(req.rawBody, req.get("x-razorpay-signature"))) return res.status(400).send({ status: false });
  const e = req.body?.payload?.payment?.entity;
  if (["payment.captured", "order.paid"].includes(req.body?.event) && e?.order_id) await finalizePayment({ razorpayOrderId: e.order_id }, { razorpayPaymentId: e.id });
  res.send({ status: true });
}));

router.use(authenticate);
router.post("/order", authLimiter, requireVerified, validate(z.object({ plan: z.string().max(20), couponCode: z.string().trim().max(30).optional() })), asyncHandler(async (req, res) => {
  res.status(201).send({ status: true, ...(await createOrder(req.user, req.body.plan, req.body.couponCode)) });
}));

router.post("/verify", validate(z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })), asyncHandler(async (req, res) => {
  if (env.paymentMode !== "razorpay") throw new AppError("Not available", 404);
  const { razorpay_order_id: o, razorpay_payment_id: id, razorpay_signature: sig } = req.body;
  if (!rzp.verifyCheckout(o, id, sig)) throw new AppError("Payment signature mismatch", 400);
  const r = await finalizePayment({ razorpayOrderId: o, userId: req.user._id }, { razorpayPaymentId: id });
  if (!r) { const done = await Payment.findOne({ razorpayOrderId: o, userId: req.user._id, status: "paid" }); if (!done) throw new AppError("Payment not found", 404); return res.send({ status: true, payment: done }); } // webhook got there first
  res.send({ status: true, msg: "Payment successful", payment: r.pay, subscription: r.sub });
}));

// Development only: PAYMENT_MODE=mock is refused at startup in production
router.post("/mock-confirm", validate(z.object({ orderId: z.string().max(60) })), asyncHandler(async (req, res) => {
  if (env.paymentMode !== "mock") throw new AppError("Not available", 404);
  const r = await finalizePayment({ razorpayOrderId: req.body.orderId, userId: req.user._id });
  if (!r) throw new AppError("Order not found", 404);
  res.send({ status: true, msg: "Mock payment confirmed", payment: r.pay, subscription: r.sub });
}));

router.get("/mine", asyncHandler(async (req, res) => res.send({ status: true, payments: await Payment.find({ userId: req.user._id, status: { $ne: "created" } }).sort({ createdAt: -1 }).limit(100).select("-razorpayOrderId").lean() })));

router.get("/:id/invoice", asyncHandler(async (req, res) => {
  const pay = await Payment.findOne({ _id: req.params.id, userId: req.user._id, status: { $in: ["paid", "refunded"] } }).lean();
  if (!pay) throw new AppError("Invoice not found", 404);
  const user = await User.findById(pay.userId).select("username email").lean();
  const inv = { invoiceNumber: pay.invoiceNumber, date: pay.paidAt, customer: user, plan: PLANS[pay.plan]?.name || pay.plan, subtotal: pay.baseAmount, discount: pay.discount, coupon: pay.couponCode, total: pay.amount, status: pay.status, currency: "INR" };
  if (req.query.format !== "html") return res.send({ status: true, invoice: inv });
  const e = escHtml;
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'").type("html").send(`<!doctype html><meta charset="utf-8"><title>${e(inv.invoiceNumber)}</title>
<body style="font-family:sans-serif;max-width:640px;margin:2rem auto"><h1>Streamify invoice ${e(inv.invoiceNumber)}</h1><p>${e(new Date(inv.date).toDateString())}</p>
<p><b>Billed to:</b> ${e(user?.username)} (${e(user?.email)})<br><b>Plan:</b> ${e(inv.plan)}${inv.status === "refunded" ? " (REFUNDED)" : ""}</p>
<table width="100%" border="1" cellpadding="6" style="border-collapse:collapse"><tr><td>Subtotal</td><td align="right">₹${e(inv.subtotal)}</td></tr>
<tr><td>Discount ${e(inv.coupon || "")}</td><td align="right">−₹${e(inv.discount)}</td></tr><tr><th align="left">Total</th><th align="right">₹${e(inv.total)}</th></tr></table></body>`);
}));

module.exports = router;
module.exports.createOrder = createOrder;
