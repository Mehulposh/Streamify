const mongoose = require("mongoose");
const env = require("./env");
mongoose.set("strictQuery", true);
module.exports = async () => {
  try { await mongoose.connect(env.mongoUri); console.log("Connected to MongoDB"); }
  catch (e) { console.error("Could not connect to MongoDB:", e.message); process.exit(1); }
};
