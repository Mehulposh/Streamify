const { z } = require("zod");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "invalid id");
const email = z.string().trim().toLowerCase().email().max(120);
const password = z.string().min(8, "at least 8 characters").max(72)
  .regex(/[A-Za-z]/, "must contain a letter").regex(/\d/, "must contain a number");
const username = z.string().trim().min(3, "at least 3 characters").max(20).regex(/^[A-Za-z0-9_.-]+$/, "letters, numbers, . _ - only");
const mediaType = z.enum(["movie", "tv"]);
const tmdbId = z.coerce.number().int().positive().max(1e9);
const bool = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
module.exports = { z, objectId, email, password, username, mediaType, tmdbId, bool };
