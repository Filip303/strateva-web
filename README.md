# Strateva Payment Router — Web

> ⚠️ **Simulation only. Strateva does not execute, custody, convert or
> transmit anyone's funds.**
>
> This website is a public, demonstrative laboratory. It moves no real money,
> holds no keys, connects to no real providers or wallets, performs no KYC and
> is not an authorized financial service. Providers, fees, FX rates and
> reliability figures are **synthetic**; per-leg timing is labelled with its
> provenance (declarative, observed or fallback) — an observed leg carries
> measured latency evidence, never a real transfer executed by Strateva.

## What it is

This repository contains the **public frontend** of Strateva Payment Router:
an intelligent routing engine for international payments that models payment
infrastructures (bank transfers, SEPA, SWIFT, providers, FX, stablecoin rails)
as a directed graph and searches for the best route between an origin and a
destination according to **cost, time and reliability**.

The website is a **laboratory / simulator**: it lets you compare simulated
routes and understand why one is recommended over the others. It is not a
money-transfer product and will not become one within this scope.

## Status

- **v1: public, no sign-up and no payments.** There is no login, there are no
  accounts, nothing is charged or sent. The website only queries a read-only
  public HTTP contract and renders the result.
- The routing engine lives in the public backend repository
  `Filip303/strateva-payment-router` and exposes a REST API. This website is
  purely its presentation layer.

## Language

- **English is the only language of v1.** All visible product content — copy,
  navigation, URL paths, error messages, metadata and legal-page labels — is
  in English.
- No additional locale is included in v1: no language selector, no localized
  routes, no hreflang. Additional locales are outside the initial launch
  scope.

## Scope of this repository (current phase)

The repository now contains the **frontend foundation**: a React + TypeScript
+ Vite application with React Router, an accessible shared layout, English-only
skeleton pages for every route in the sitemap, unit tests (Vitest + Testing
Library), Playwright smoke tests and a verification-only CI workflow.

The simulator and the corridors page now consume the **public HTTP contract
only** — `GET /api/v1/corridors` and `POST /api/v1/routes/quote` on the URL
configured via `VITE_API_URL`, with every response validated at runtime
before rendering. That is the app's **only** network surface: there are no
analytics, no tracking, no cookies and no browser storage. Quote requests
are never retried automatically.

The repository also contains **auditable staging hosting configuration**
(Dockerfile + Caddy + `railway.toml` + a CI container smoke test) that is
**not deployed anywhere yet** — see
[Staging hosting](#staging-hosting-implemented-not-deployed).

The product documentation lives in `docs/` (product contract, sitemap,
textual wireframes, API-to-UI mapping and terminology) and remains the
authoritative functional contract.

## Prerequisites

- Node.js 22.22.2 (LTS) — pinned exactly in `.nvmrc` and `package.json`
  `engines`.
- npm 10.9.7 — pinned in `package.json` `packageManager`.

## Installation

```bash
npm ci
```

Installs exactly the dependency tree pinned in `package-lock.json`.

## Configuration

Copy `.env.example` to `.env` and set the public API base URL:

```bash
VITE_API_URL=http://localhost:8000
```

- `VITE_API_URL` is the **only** backend URL. There is deliberately **no
  fallback** (no Railway/staging/production default): if it is missing or
  invalid, the app fails safe with a sanitized message and sends no request.
- Only a **clean `http`/`https` origin** is accepted (an optional trailing
  slash is tolerated). URLs carrying credentials, a query string, a fragment
  or a base path are rejected — base-path support is out of scope for v1.
- **Every `VITE_*` variable is public**: Vite embeds it into the browser
  bundle. Never put secrets, tokens or private endpoints in one.
- Requests use `credentials: "omit"`, a 15-second timeout, and are never
  retried automatically (retrying is always a manual user action; a 429's
  `Retry-After` is honored before the retry button re-enables).

## Local development

```bash
npm run dev       # start the Vite dev server
npm run build     # production build (output in dist/)
npm run preview   # serve the production build locally
```

## Verification

```bash
npm run lint         # ESLint
npm run typecheck    # strict TypeScript, no emit
npm run test         # unit tests (Vitest + Testing Library)
npm run build        # production build (no source maps)
npm run verify:dist  # bundle checks: no maps/secrets/private endpoints, budgets
npm run test:e2e     # Playwright: flows, axe A/AA and metadata at 5 widths
```

The CI workflow (`.github/workflows/ci.yml`) runs exactly these steps (plus
`npm audit --audit-level=high`) on pull requests and on `main`. It verifies
only — it never deploys.

## Staging hosting (implemented, NOT deployed)

The repository contains everything needed to serve the static build on
Railway behind Caddy — **and none of it is deployed**. There is no Railway
project wired to this repo, no DNS change, no `*.up.railway.app` URL, no
GitHub secret and no auto-deploy: this is reviewable configuration only.

- **`Dockerfile`** — multi-stage: Node 22.22.2 (pinned by version and
  digest) runs `npm ci`, validates the `VITE_API_URL` build argument
  (`scripts/validate-api-origin.mjs` — the build **fails** if it is missing
  or not a clean http(s) origin), then `npm run build` and
  `npm run verify:dist`. The final image (Caddy 2.10.2, pinned by version
  and digest, running as a non-root user) contains only Caddy, the rendered
  `Caddyfile` and `dist/` — no Node, no sources, no `node_modules`.
- **`Caddyfile`** — listens on Railway's injected `PORT` (TLS terminates at
  Railway's edge; `auto_https off`, `admin off`, `persist_config off`), no
  access logs (no IPs, paths or headers are recorded), compression, a
  static `/health` endpoint, and the full header contract from
  `docs/WEB_SECURITY_HEADERS.md`. Routing serves an existing file first,
  then the route's own generated `dist/<route>/index.html` (so
  `/methodology` returns the Methodology HTML with its own title and
  canonical before any JavaScript), and only then the SPA fallback —
  unknown routes get HTTP 200 and React renders the 404 page (a real HTTP
  404 status is deliberately not claimed).
- **Caching for fast rollback** — hashed `/assets/*` are immutable for a
  year (their names change with content); HTML, `robots.txt`,
  `sitemap.xml` and the manifest are `no-cache`, so a redeploy or rollback
  is visible immediately.
- **One origin, one source of truth** — the same public `VITE_API_URL`
  given to the build is baked into the bundle **and** rendered into the
  CSP `connect-src`. `VITE_*` variables are public by definition; no
  secret is involved anywhere.
- **Mandatory deployment mode + HSTS** — `STRATEVA_DEPLOYMENT_ENV` is
  **required** at runtime and must be exactly `staging` or `production`.
  The container entrypoint validates it before Caddy starts: a missing,
  empty or invalid value makes the container **exit non-zero before serving
  anything** (fail-closed — a misconfigured production can never silently
  run without HSTS). `staging` sends no HSTS; `production` sends exactly
  `max-age=31536000; includeSubDomains` (no `preload`). It is the same
  single variable Caddy reads — there is no second toggle that could
  diverge.
- **`railway.toml`** — `DOCKERFILE` builder, `/health` health check and a
  bounded `ON_FAILURE` restart policy only: no domains, no secrets, no
  project/service IDs, no variable values. `scripts/verify-railway-toml.mjs`
  (run in CI, no network) fails on any drift of those enums or any leaked
  domain/secret/ID.

### Run the container locally (fake origin, no real API)

```bash
docker build --build-arg VITE_API_URL=https://staging-api.example.invalid -t strateva-web .
docker run --rm -e PORT=8080 -e STRATEVA_DEPLOYMENT_ENV=staging -p 127.0.0.1:8080:8080 strateva-web
```

`STRATEVA_DEPLOYMENT_ENV` is mandatory: omit it (or mistype it) and the
container exits immediately instead of starting. Then verify headers and
per-route HTML:

```bash
curl -sI http://127.0.0.1:8080/                # CSP, nosniff, Referrer-Policy, Permissions-Policy; no HSTS in staging
curl -s  http://127.0.0.1:8080/methodology | head   # Methodology title + canonical before JS
curl -sI http://127.0.0.1:8080/health          # 200, no internal info
```

CI runs `scripts/container-smoke.mjs`, which builds the image with that
same fake origin, starts it on loopback and asserts routing, every header,
caching, the source-map 404 and the deployment-mode HSTS gating (staging →
no HSTS, production → exact HSTS, missing/invalid → the container refuses
to start) — plus that the build fails for missing/invalid origins, that
`railway.toml` keeps its audited enums, and that the `Caddyfile` stays
`caddy fmt`-clean. No external service is contacted. (Note: the CSP
includes `upgrade-insecure-requests` per the contract, so a browser pointed
at the plain-HTTP local container may upgrade asset requests; `curl`
verification is unaffected. Behind Railway's TLS edge this is irrelevant.)

The staging API origin will be `https://staging-api.strateva.ai`. When
Railway is eventually configured, its staging service will need two
variables — `VITE_API_URL=https://staging-api.strateva.ai` (build time)
and `STRATEVA_DEPLOYMENT_ENV=staging` (runtime) — set in Railway itself;
they are intentionally **not** committed to `railway.toml` or anywhere in
this repository, and Railway/DNS remain unconfigured.

## Release hardening notes

- HTTP responses from the API are size-capped (1 MiB, enforced incrementally
  while streaming) on top of the 15 s timeout, with no automatic retries.
- Security headers (CSP, HSTS, etc.) are **implemented by the in-repo Caddy
  configuration and verified in CI, but not yet deployed**: the exact
  contract lives in `docs/WEB_SECURITY_HEADERS.md`.
- Automated accessibility scanning (axe, WCAG 2.2 A/AA tags) runs in CI on
  every route at five widths; the pending manual checks are tracked in
  `docs/ACCESSIBILITY_CHECKLIST.md` — passing axe is not a full-conformance
  claim.

## Project structure

```
├── docs/                  Product contract (authoritative, unchanged)
├── e2e/                   Playwright smoke tests
├── src/
│   ├── api/               Typed client, Zod contract schemas, config, errors
│   ├── components/        Shared accessible layout
│   ├── pages/             One page per route (simulator + corridors are live)
│   ├── test/              Unit tests and test setup
│   ├── App.tsx            Route table
│   ├── main.tsx           Entry point
│   └── index.css          Neutral CSS foundation (variables, focus, notice)
├── index.html             English metadata, no third-party assets
├── Dockerfile             Staging hosting image (build + Caddy; not deployed)
├── Caddyfile              Serving contract: routing, headers, caching
├── railway.toml           Railway build/health config (no domains, no secrets)
└── .github/workflows/     Verification-only CI (never deploys)
```

## Contribution rules

The rules for contributing (human and automated) are in
[`AGENTS.md`](./AGENTS.md). In short: the website only consumes the public
HTTP contract, never imports anything from the private backend repository,
contains no secrets, ships English-only visible copy in v1, and every PR is
opened as a draft with no deploy.

## License

To be defined.
