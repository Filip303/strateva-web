# Web security headers — hosting contract (NOT yet deployed)

> **Status: REQUIRED, NOT ACTIVE.** No hosting is chosen or configured yet,
> so none of these headers is currently applied anywhere. This document is
> the exact contract the hosting layer MUST implement for staging and
> production before launch. Nothing in the application pretends these
> protections exist today.

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

### Other headers (all environments)

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

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
