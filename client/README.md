# Streamify – Frontend v2

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
