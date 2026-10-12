// Usage: node scripts/createAdmin.js username admin@example.com 'StrongPass123'
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../config/env");
const { User, Profile } = require("../models");
const { password, username, email } = require("../utils/schemas");
(async () => {
  const [un, em, pw] = process.argv.slice(2);
  if (!un || !em || !pw) { console.error("Usage: node scripts/createAdmin.js username email password"); process.exit(1); }
  const checks = [username.safeParse(un), email.safeParse(em), password.safeParse(pw)].filter((r) => !r.success);
  if (checks.length) { console.error("Invalid input:", checks.flatMap((c) => c.error.issues.map((i) => i.message)).join(", ")); process.exit(1); }
  await mongoose.connect(env.mongoUri);
  if (await User.exists({ $or: [{ email: em.toLowerCase() }, { username: un }] })) { console.error("A user with this email/username already exists"); process.exit(1); }
  const u = await User.create({ username: un, email: em, role: "admin", emailVerified: true, password: await bcrypt.hash(pw, 12) });
  await Profile.create({ userId: u._id, name: un });
  console.log("Admin created:", em);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
