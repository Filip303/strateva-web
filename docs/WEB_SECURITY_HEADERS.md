# Web security headers — hosting contract (implemented, NOT yet deployed)

> **Status: IMPLEMENTED IN CODE, NOT DEPLOYED.** The repository now contains
> a Caddy configuration (`Caddyfile`, shipped by the `Dockerfile`) that
> sends every header in this contract, and CI verifies them on a locally
> built container (`scripts/container-smoke.mjs`). **No environment serves
> them yet**: Railway, DNS and the strateva.ai domains remain unconfigured,
> and nothing in this repository deploys anything. This document stays the
> authoritative contract; the Caddyfile is its implementation.

## How the implementation works

- `Caddyfile` is a template: the `__API_ORIGIN__` placeholder in
  `connect-src` is rendered at **Docker build time** from the same
  `VITE_API_URL` build argument that is baked into the app bundle, after
  validation by `scripts/validate-api-origin.mjs` (clean http(s) origin
  only; the build fails otherwise). One value drives both the bundle and
  the CSP — they can never diverge.
- The deployment mode is a **mandatory** runtime variable
  `STRATEVA_DEPLOYMENT_ENV`, validated by the container entrypoint before
  Caddy starts. It must be exactly `staging` or `production`; a missing,
  empty or invalid value makes the container **exit non-zero before serving
  anything** (fail-closed by refusing to start, never a silent permissive
  boot). Caddy sends HSTS **only** in `production` mode — the same single
  validated variable, with no separate manual toggle that could diverge.
- CI builds the image with the fake origin
  `https://staging-api.example.invalid` and asserts the exact header
  values, the HSTS gating in all three modes, per-route HTML, caching and
  the source-map 404 on loopback, with no external service and no secret.

HSTS and `frame-ancestors` (and CSP in its full form) only work as **real
HTTP response headers**. They are deliberately NOT faked with `<meta>` tags
in `index.html` — a meta tag cannot express them correctly.

## Required response headers

Serve on every response (HTML, assets, and the SPA fallback), unless noted.

### Content-Security-Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://www.googletagmanager.com;
  style-src 'self';
  img-src 'self' https://www.googletagmanager.com https://www.google-analytics.com;
  font-src 'self';
  connect-src 'self' <API_ORIGIN> https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com;
  base-uri 'none';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests
```

- `<API_ORIGIN>` is the **exact origin** of that environment's public API
  (scheme + host + port), the same value baked into `VITE_API_URL` at build
  time. One environment, one origin — never a wildcard, never a list of
  fallbacks.
- The Google Analytics hosts are the **only** third-party sources, added to
  support **consent-gated** analytics (see "Analytics and consent" below). They
  are fixed literals — `gtag.js` is served from `www.googletagmanager.com`
  (`script-src`), and GA4's collection endpoints are on `img-src`/`connect-src`.
  No other third party is allowed.
- The app still inlines **no** scripts or styles: the GA4 bootstrap is a
  first-party module (`src/analytics/ga.ts`), not an inline `<script>`, so
  **no `unsafe-inline` and no `unsafe-eval`** are needed. Any new tag/vendor
  requiring them must update this contract first.

### Strict-Transport-Security (production HTTPS only)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- Apply ONLY on the production HTTPS origin. Do not send it from plain-HTTP
  local/preview servers, and hold `preload` until the domain strategy is
  final.
- Implementation: the container sends this header only when
  `STRATEVA_DEPLOYMENT_ENV=production` at runtime. `staging` starts and
  sends no HSTS; a missing or invalid mode makes the container exit
  non-zero before boot (it never serves without HSTS in production). All
  four cases (staging on/no-HSTS, production on/HSTS, missing → refuse,
  invalid → refuse) are asserted by the CI container smoke test.

### Other headers (all environments)

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

### Search-engine indexing (staging must not be indexed)

Gated by the SAME validated `STRATEVA_DEPLOYMENT_ENV` — no second variable.

- **staging**: every response carries
  `X-Robots-Tag: noindex, nofollow, noarchive`, and `/robots.txt` is served
  as `User-agent: *` / `Disallow: /` with **no sitemap** (a committed file
  kept outside `dist/`, so it never reaches the bundle and production never
  serves it).
- **production**: no `X-Robots-Tag` is sent, and `/robots.txt` is the normal
  `public/robots.txt` (`Allow: /` plus `Sitemap: https://strateva.ai/sitemap.xml`);
  the production sitemap is unchanged.

This is a hosting-layer concern only: it changes no page content, route,
CSP, HSTS or caching. The CI container smoke test asserts both modes.

## Analytics and consent

Strateva loads **Google Analytics 4** (measurement id `G-PNQWWXSPZX`, via
`gtag.js`) for optional audience measurement. This is **not anonymous** — GA4
assigns a pseudonymous client id (the `_ga` cookie) and processes IP, device,
browser and pages viewed — so it is **opt-in and consent-gated** to satisfy
GDPR/ePrivacy prior-consent rules:

- Nothing analytics-related loads on first paint. A consent banner
  (`src/components/ConsentBanner.tsx`) asks the visitor to accept or reject.
- **Restricted to audience measurement (Consent Mode v2).** On load the module
  grants **only** `analytics_storage`; `ad_storage`, `ad_user_data` and
  `ad_personalization` stay `denied`, and `allow_google_signals` /
  `allow_ad_personalization_signals` are set to `false`. No Ads, remarketing or
  personalization. On withdrawal a Consent Mode `update` sets analytics and all
  advertising states to `denied` before cookies are cleared and the page
  reloads.
- GA4 is injected by a **first-party module** (`src/analytics/ga.ts`) **only**
  after an explicit "Accept" — never before, and never on "Reject". A granted
  choice is remembered (a single non-personal flag in `localStorage`,
  `strateva-analytics-consent`) and re-loads analytics on the next visit; a
  denied or absent choice loads nothing and sets no analytics cookie.
- `gtag.js` is fetched from `www.googletagmanager.com/gtag/js`; GA4's collection
  goes to the `google-analytics.com` endpoints. Because the bootstrap is
  first-party (not an inline `<script>`), the CSP needs no `unsafe-inline`, and
  the GA hosts above are the only additions.
- The served HTML never hardcodes analytics: the CI container smoke test asserts
  the markup contains no loader host, no `gtag(` bootstrap and no GA4 id, and
  `scripts/verify-dist.mjs` fails the build on any GA4 measurement id other than
  the approved `G-PNQWWXSPZX`, any GTM container id, a hardcoded
  `google-analytics.com` reference, or the `gtag.js` loader appearing outside
  the JS bundle — proving analytics cannot fire without consent and no other
  analytics can slip in.
- **Withdrawal is as easy as granting.** A permanent "Privacy choices" control
  in the footer re-opens the banner. Withdrawing a granted consent stores
  `denied`, removes GA's `_ga`/`_ga_*` cookies (best-effort) and reloads the
  page so the already-executed analytics script and state are discarded and not
  loaded again — no need to clear all site data.
- The `/legal/privacy` and `/legal/cookies` pages disclose this. If GA4 is
  configured to fire beyond basic audience measurement (e.g. Ads/remarketing),
  the CSP and those pages must be updated first.

### Manual GA property review (required, outside this repo)

The code restricts GA4 to audience measurement, but the **property settings**
are managed in Google Analytics, not here. Before relying on this in a real
environment, confirm in the GA Admin for `G-PNQWWXSPZX` that it:

- has **Google Signals** disabled for this use;
- is **not linked to Google Ads** or other advertising products;
- has **no remarketing, Ads personalization or advertising features** enabled;
- uses **data retention and data-sharing** settings consistent with the
  published privacy/cookies pages.

This cannot be asserted from code; it is a manual, out-of-band verification.

## Source maps policy

Production builds are generated with `sourcemap: false` (see
`vite.config.ts`) and `npm run verify:dist` fails the build if any `.map`
file or `sourceMappingURL` reference reaches `dist/`. The hosting layer must
not add or serve source maps for production assets.

## Post-deployment verification procedure

After every staging/production deployment:

1. `curl -sI https://<host>/` and confirm every header above is present
   with the exact expected value (CSP, HSTS on production, nosniff,
   Referrer-Policy, Permissions-Policy).
2. `curl -sI https://<host>/simulator` (SPA fallback) — same headers.
3. `curl -sI https://<host>/assets/<main>.js` — `X-Content-Type-Options`
   present; correct `Content-Type`.
4. Confirm `curl -s https://<host>/assets/<main>.js.map` returns 404.
5. In the browser dev tools, confirm no CSP violations are reported while
   loading the home page and running one simulated quote.
6. Confirm the app is not frameable: embedding it in an `<iframe>` from
   another origin must be blocked.
7. Re-run this checklist whenever the API origin, the hosting provider or
   the build pipeline changes.
