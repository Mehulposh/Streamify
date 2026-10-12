const crypto = require("crypto");
const env = require("../config/env");
const { AppError, safeEqual } = require("./helpers");
const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");
async function call(path, body) {
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1${path}`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new AppError(data?.error?.description || "Payment gateway error", 502);
  return data;
}
module.exports = {
  createOrder: ({ amountPaise, receipt, notes }) => call("/orders", { amount: amountPaise, currency: "INR", receipt, notes }),
  refund: (paymentId, amountPaise) => call(`/payments/${paymentId}/refund`, { amount: amountPaise }),
  verifyCheckout: (orderId, paymentId, sig) => safeEqual(hmac(env.razorpay.keySecret, `${orderId}|${paymentId}`), sig || ""),
  verifyWebhook: (raw, sig) => !!env.razorpay.webhookSecret && !!raw && safeEqual(hmac(env.razorpay.webhookSecret, raw), sig || ""),
};
