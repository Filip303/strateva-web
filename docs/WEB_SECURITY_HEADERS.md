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
  script-src 'self';
  style-src 'self';
  img-src 'self';
  font-src 'self';
  connect-src 'self' <API_ORIGIN>;
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
- Scripts and styles are all first-party (the app inlines nothing and loads
  no external fonts, images or scripts), so no `unsafe-inline`,
  `unsafe-eval`, nonces or hashes are needed. If a future change requires
  them, that change must update this contract first.

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
