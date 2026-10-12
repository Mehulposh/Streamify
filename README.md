# Streamify – Server v2

Hardened rewrite of the Express + MongoDB API. **The old URLs keep working** (`/api/auth`, `/api/saved`, `/api/review`,
`/api/subscription`, same plan ids, same `{status, msg}` response shape), so the current React app still runs; new features live under new routes.

## Run
```bash
cp .env.example .env     # fill MONGO_DB, JWT_SECRET, TMDB_TOKEN  (ROTATE the old secrets – they were inside the zip)
npm install
npm run migrate          # only if you have data from the old version (adds profiles, fixes indexes, audits admins)
npm run create-admin -- yourname you@example.com 'StrongPass123'
npm run dev              # http://localhost:3001      npm test  -> unit tests
```
`PAYMENT_MODE`: `razorpay` (add keys), `mock` (dev only – subscriptions activate instantly; **refused in production**), `disabled`.

## Security fixes
| # | Problem in the old code | Fix |
|---|---|---|
| 1 | `register` trusted `role` from the request body → anyone could be admin | Zod schema strips unknown keys; role is always `user`. Admins only via `ADMIN_REGISTRATION_KEY` header or `npm run create-admin` |
| 2 | "Admin" routes (list/delete users, list/delete subscriptions) only checked login | `requireAdmin` on every admin route; role is read from the DB, never from the token |
| 3 | JWT secret hard-coded as `"SSC"`, tokens never expired, invalid token → HTTP 500 | `JWT_SECRET` from env (≥ 32 chars in prod), HS256 pinned, 7-day expiry, tokens die on password change, 401 on bad token. Optional httpOnly cookie |
| 4 | Paywall was a `localStorage` timer in the browser | Trial and access are decided **on the server** (`/api/access`), trailers sit behind `requireAccess`, TMDB token never reaches the browser |
| 5 | Subscriptions never expired | Lazy expiry on every read + hourly job; one active subscription per user (unique partial index); buying again **extends** it |
| 6 | `editreview` / `deletereview` had no auth → always HTTP 500 | Fixed; owner or admin only |
| 7 | "Subscribe" created a plan for free; client could send anything | Server-side price list, real payment (Razorpay order + signature verify + webhook), idempotent activation, reconciliation job |
| 8 | `cors()` open to every website; no rate limits; no validation | CORS allow-list, helmet, rate limits (global/auth/write/TMDB), Zod on all writes, NoSQL-operator stripping, 100 kb body cap |
| 9 | Login revealed which emails exist; no lockout | Single generic message, constant-time compare, 5 fails → 15 min lock |
| 10 | Review/watchlist edits by id only | Ownership checks everywhere; per-profile data isolation |
| + | Secrets in the shared zip | `.env.example`, `.gitignore`, server refuses to start without secrets |

## Features → endpoints
| Feature | Endpoints |
|---|---|
| **Real payments**, invoices, cancel/resume, plan catalogue | `GET /api/subscription/plans` · `POST /api/payments/order` → `POST /api/payments/verify` (+ `/webhook`) · `GET /api/payments/mine`, `/:id/invoice?format=html` · `POST /api/subscription/cancel|resume` · legacy `POST /api/subscription/create` |
| **Server-side access / trial** | `GET /api/access/status` · `POST /api/access/start-trial` · expiry reminders by in-app + email |
| **Profiles** (kids, PIN, daily limit) | `/api/profiles` CRUD · `POST /:id/unlock` (PIN → `x-profile-token`) · `GET /:id/watch-time`. Send `x-profile-id` on every request |
| **Continue watching & history** | `PUT /api/history` (player heartbeat) · `GET /api/history/continue` · `GET/DELETE /api/history` · `POST /api/history/playback/start` |
| **Recommendations** | `GET /api/recommendations` ("Picked for you", "Because you like X", "Because you watched Y") |
| **Star ratings + reviews** | `PUT /api/ratings` · `GET /api/ratings/summary/:type/:id` · reviews now have helpful votes (`POST /api/review/:id/helpful`), pagination, `?sort=helpful`, one review per title |
| **Custom lists** + share link | `/api/lists` · `POST /:id/items` · public `GET /api/lists/shared/:shareId` |
| **Search** | `GET /api/tmdb/discover/movie?genre=28&year=2024&minRating=7&sort=…&originalLanguage=hi` · `GET /api/search/suggest?q=` · `/api/search/history` |
| **Notifications** (EN/HI) | `/api/notifications` · release reminders for watchlist titles, plan expiring, payments, follows, shares |
| **Social** | `/api/social` follow/unfollow, `feed` (opt-in via `PATCH /api/auth/settings {shareActivity}`), `users/:name`, `share` |
| **Review moderation** | profanity → held for approval; 3 reports → auto-hidden; admin `GET /api/admin/reviews`, `POST /api/admin/reviews/:id/status` |
| **Account tools** | verify email, forgot/reset/change password, **Google sign-in** (`POST /api/auth/google`), delete account |
| **Admin analytics** | `GET /api/admin/analytics/overview` (revenue, new users, active subs, churn, plan mix, most saved/watched, top rated) · `GET /api/admin/export/users|subscriptions|payments` (CSV) · pagination + search on users/subscriptions/payments |
| **Coupons, free-trial links, referrals** | admin `POST /api/admin/coupons` (percent / flat / trial days) · `POST /api/coupons/validate|redeem` · referral code at register → inviter gets free days |
| Cast pages, "where to watch" | via the TMDB proxy: `/api/tmdb/person/:id/combined_credits`, `/api/tmdb/movie/:id/watch/providers` |
| Parental PIN & limits, language | profile PIN, `dailyLimitMinutes`, profile `language` is passed to TMDB (e.g. `hi-IN`) |

All TMDB calls now go through `GET /api/tmdb/*` (whitelisted paths and parameters, 5-minute server cache, kids filtering).

## What the current frontend must change
* `POST /api/subscription/create` now **starts a payment** (Razorpay checkout), it no longer activates a plan by itself. In `mock` mode it still activates instantly for development.
* Call `POST /api/access/start-trial` instead of the localStorage timer; handle HTTP **402 `SUBSCRIPTION_REQUIRED`**.
* Send `x-profile-id` (and `x-profile-token` for PIN profiles); use `/api/tmdb/...` instead of calling TMDB directly and remove the TMDB token from the frontend `.env`.
* Login/register failures still return HTTP 200 + `{status:false,msg}` for compatibility; everything else uses proper status codes.

## Notes and limits
* Verified here: syntax of all files, **8 unit tests passing** (pricing, profanity, CSV injection, TMDB allow-list/params, kids filter, scoring), and that all 40 modules load with every import resolving. It was **not run against a live MongoDB / Razorpay / TMDB** (no network in the build environment), so smoke-test the payment and login flows once.
* Caches and the scheduler are in-process; with several server instances use Redis and run `jobs/scheduler.js` from one instance.
* There is no video hosting: playback means TMDB trailers. `POST /api/history/playback/start` + `PUT /api/history` are ready for a real player.
* Auto-renewal is not automatic (Razorpay one-time orders); reminders tell users to renew and a new purchase extends the plan.

# Streamify – Client v2

React 18 + Vite + Tailwind CSS 3. Cinematic **glassmorphism** UI with a **light / dark theme toggle**, built for `streamify-backend` v2.

## Run
```bash
# 1. backend (../streamify-backend): npm install, cp .env.example .env (set TMDB_TOKEN), npm run dev   -> http://localhost:3001
# 2. frontend:
npm install
cp .env.example .env      # optional
npm run dev               # http://localhost:5173
npm run build             # production bundle in dist/
```
Keep `CLIENT_URL=http://localhost:5173` in the backend `.env`. The dev server **proxies `/api` to the backend**, so the httpOnly login cookie
and every request are same-origin (no CORS or token handling in the browser). In production serve `dist/` and `/api` from one domain.
No TMDB token is needed in this project any more: the catalogue is fetched through the server (`/api/tmdb/*`).

## Design
* **Glass** surfaces (`.glass`, `.glass-strong` in `src/index.css`), a gradient + floating-blob backdrop (`components/Background.jsx`), poster hover effects, skeleton loaders, snap-scroll carousels.
* **Theme toggle** (sun/moon) in the navbar, landing and auth pages; saved in `localStorage`, applied before first paint (no flash). Dark is the default, as on streaming apps.
* Responsive: mobile menu, touch-friendly rows, fluid poster grids.

## Screens
| Area | What is there |
|---|---|
| Public | Landing, Login, Register (referral code), Google sign-in (set `VITE_GOOGLE_CLIENT_ID`), Forgot / Reset password, Verify email, **public shared lists** (`/lists/shared/:id`) |
| Profiles | "Who is watching?" picker, **PIN unlock**, manage profiles (avatar, **kids mode**, language, **daily watch limit**, PIN) |
| Browse | **Home** (rotating hero, *Continue watching*, *Picked for you* rows, trending, popular, top rated, coming soon), **Movies / Series** with genre chips + year, rating, language, sort and *load more*, **Search** with type-ahead suggestions and recent searches, **Person** pages |
| Title page | Backdrop hero, **trailer player** (paywall + daily limit + progress heartbeats), watchlist, mark watched, **add to list**, **share with a friend**, community **star rating**, where to watch, cast, **reviews** (helpful votes, report, edit/delete, sort), similar and recommended |
| Library | Watchlist (tabs, filters, sort), **History & ratings** (progress bars, daily usage), **Lists** (create, public toggle, copy link) |
| Account | **Subscription** (plans, coupon, Razorpay checkout or test mode, cancel/resume, trial, redeem code, invoices, referral link), Notifications (EN/HI from the server), **Friends** (activity feed, follow, find people, user pages), Settings (language, privacy switch, change password, delete account) |
| Admin | **Overview** (revenue, churn, subscribers, popular titles), Users (block, gift days, delete), Subscriptions, Payments (refund), Coupons, **Review moderation**, Tools (broadcast, CSV export) |

## How it talks to the backend
* Every request carries `x-profile-id` (and `x-profile-token` for PIN profiles). A `402` opens the **paywall modal**, `403 PROFILE_LOCKED` returns to the profile picker, `401` logs out.
* The trial is started on the server (`POST /api/access/start-trial`), and the free-trial countdown comes from the server, so clearing browser storage no longer resets it.
* The player calls `POST /api/history/playback/start`, then `PUT /api/history` every 15 s. That powers Continue watching, daily limits and recommendations.

## Notes
* The player embeds the **YouTube trailer** (TMDB has no film streams). To stream real video, replace the `<iframe>` in `src/components/Player.jsx` with your `<video>` source; the heartbeat logic stays.
* In `PAYMENT_MODE=mock` (dev) the Subscription page simulates a payment; with Razorpay keys it opens the real checkout.
* Verified in the build environment: all 45 source files parse (JSX), no undefined identifiers, every relative import and named export resolves, and every API call matches a backend route.
  It could **not** be bundled or opened in a browser there (no network for `npm install`), so run it once and report anything odd.
* Movie data by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
