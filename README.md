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
analytics, no tracking, no cookies, no browser storage and **no deployment
configuration**. Quote requests are never retried automatically.

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
npm run lint       # ESLint
npm run typecheck  # strict TypeScript, no emit
npm run test       # unit tests (Vitest + Testing Library)
npm run build      # production build
npm run test:e2e   # Playwright smoke tests (run npm run build first)
```

The CI workflow (`.github/workflows/ci.yml`) runs exactly these steps on
pull requests and on `main`. It verifies only — it never deploys.

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
└── .github/workflows/     Verification-only CI
```

## Contribution rules

The rules for contributing (human and automated) are in
[`AGENTS.md`](./AGENTS.md). In short: the website only consumes the public
HTTP contract, never imports anything from the private backend repository,
contains no secrets, ships English-only visible copy in v1, and every PR is
opened as a draft with no deploy.

## License

To be defined.
