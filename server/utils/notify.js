const env = require("../config/env");
const { User, Notification } = require("../models");

const T = {
  en: {
    payment_received: ["Payment received", "₹{amount} paid. Invoice {invoice}."],
    subscription_activated: ["Subscription active", "Your plan is active until {date}."],
    subscription_expiring: ["Plan ending soon", "Your subscription ends on {date}. Renew to keep watching."],
    subscription_expired: ["Plan expired", "Your subscription has ended. Renew to continue."],
    release_soon: ["Coming soon: {title}", "{title} releases on {date}. It is on your watchlist."],
    review_helpful: ["Your review was helpful", "Someone found your review of {title} helpful."],
    review_hidden: ["Review under moderation", "Your review is hidden until a moderator approves it."],
    new_follower: ["New follower", "{name} started following you."],
    shared_title: ["{name} shared a title", "{name} recommends {title}. {message}"],
    referral_reward: ["Referral bonus", "You earned {days} free days because a friend subscribed."],
    gift: ["Free days added", "{days} free days were added to your account."],
    admin_message: ["{title}", "{body}"],
  },
  hi: {
    payment_received: ["भुगतान मिला", "₹{amount} का भुगतान हुआ। इनवॉइस {invoice}।"],
    subscription_activated: ["सब्सक्रिप्शन चालू", "आपका प्लान {date} तक चालू है।"],
    subscription_expiring: ["प्लान जल्द खत्म", "आपका सब्सक्रिप्शन {date} को खत्म होगा। देखते रहने के लिए रिन्यू करें।"],
    subscription_expired: ["प्लान खत्म", "आपका सब्सक्रिप्शन खत्म हो गया। जारी रखने के लिए रिन्यू करें।"],
    release_soon: ["जल्द आ रहा है: {title}", "{title} {date} को रिलीज़ होगी। यह आपकी वॉचलिस्ट में है।"],
    review_helpful: ["आपकी समीक्षा उपयोगी रही", "किसी को {title} पर आपकी समीक्षा उपयोगी लगी।"],
    review_hidden: ["समीक्षा मॉडरेशन में", "मॉडरेटर की मंजूरी तक आपकी समीक्षा छिपी रहेगी।"],
    new_follower: ["नया फॉलोअर", "{name} ने आपको फॉलो किया।"],
    shared_title: ["{name} ने एक शीर्षक भेजा", "{name} सुझाते हैं: {title}। {message}"],
    referral_reward: ["रेफरल बोनस", "आपके दोस्त के सब्सक्राइब करने पर {days} दिन मुफ्त मिले।"],
    gift: ["मुफ्त दिन जोड़े गए", "आपके खाते में {days} दिन जोड़े गए।"],
    admin_message: ["{title}", "{body}"],
  },
};
const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? "");

let transporter;
async function sendMail(to, subject, text) {
  if (!env.smtp.host) {
    console.log(env.isProd ? `[mail] SMTP not configured, skipped "${subject}"` : `[mail:dev] to=${to}\n${subject}\n${text}\n`);
    return;
  }
  transporter ||= require("nodemailer").createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined });
  await transporter.sendMail({ from: env.smtp.from, to, subject, text });
}

/** In-app notification (+ optional email). Never throws. */
async function notify(userId, { type, params = {}, link, email = false }) {
  try {
    const u = await User.findById(userId).select("email language isBlocked");
    if (!u || u.isBlocked) return;
    const tpl = (T[u.language] && T[u.language][type]) || T.en[type];
    if (!tpl) return;
    const title = fill(tpl[0], params), body = fill(tpl[1], params).trim();
    await Notification.create({ userId, type, title, body, link });
    if (email) sendMail(u.email, title, body).catch((e) => console.error("mail failed:", e.message));
  } catch (e) { console.error("notify failed:", e.message); }
}
module.exports = { notify, sendMail };
