# AGENTS.md — Rules for contributing to Strateva Web

This document defines how automated agents and people must work in this
repository (`Filip303/strateva-web`). It is binding: any change that violates
these rules must be rejected.

> Strateva is **a simulation only**. This website does not execute, custody,
> convert or transmit funds. Nothing built here may suggest otherwise.

## Boundary with the backend

1. The frontend **only** consumes the **public HTTP contract** of the backend
   (`Filip303/strateva-payment-router`) through its REST API.
2. The frontend **never** imports code, types, configuration or any artifact
   from the private repository (`strateva-platform-private`) or from any other
   backend repository.
3. This repository **contains no secrets**: no keys, no tokens, no
   credentials, no private endpoints. Only public URLs are referenced.
4. Environment variables prefixed `VITE_*` are **public by definition** (they
   are embedded in the browser bundle). Nothing that must remain secret may
   ever be placed in a `VITE_*` variable.

## Language

- All **visible copy is English-only** in v1: interface text, navigation,
  URL paths, error messages, page metadata and legal-page labels.
- **No language selector and no additional locale** ship in v1. No localized
  routes, no hreflang. Future localization is out of scope.
- Technical API identifiers, enum values, endpoint paths, JSON fields,
  environment variables and code symbols are never translated or renamed.

## Prohibited in v1

- **Firebase**, **Supabase** or any backend-as-a-service.
- **Google login** or any authentication / login provider.
- **Wallets**, chain connections, on-chain signing.
- **Payments**, charges or any real money flow.

## Analytics (consent-gated only)

Anonymous audience measurement via **Google Analytics 4** (`gtag.js`,
measurement id `G-PNQWWXSPZX`) is permitted, but **only** under prior, explicit,
opt-in consent (GDPR/ePrivacy):

- Nothing loads before consent. A consent banner offers accept/reject; GA4 is
  injected by a first-party module **only** after "Accept" (see
  `docs/WEB_SECURITY_HEADERS.md`).
- No other analytics/telemetry/tracking vendor may be added, and no other GA4
  id. Firing GA4 beyond basic audience measurement (e.g. Ads/remarketing), or
  adding any new third party, requires updating the CSP contract and the
  `/legal/privacy` + `/legal/cookies` pages in the same change.
- The legal pages must always truthfully describe what is (and is not) loaded.

## Interface language (CTAs)

- **Prohibited**: CTAs that imply moving money — "Send money", "Pay",
  "Transfer now" — and any wording suggesting that Strateva moves funds.
- **Allowed**: "Compare routes" or "Simulate route".
- All other copy must make clear at all times that results are simulated.

## Data and storage

- Do **not** store user-entered amounts or API responses in `localStorage`
  (nor in `sessionStorage`, cookies or any other persistent store). The
  simulation is ephemeral.
- The **only** value the site may persist is the analytics consent choice — a
  single non-personal flag (`strateva-analytics-consent`) — so the user's
  opt-in/opt-out is remembered across visits.

## Change process

- Every PR is opened as a **draft**, with **no auto-merge** and **no deploy**
  attached.
- Changes must be **small and auditable**: one purpose per PR, reviewable
  diffs, no large refactors mixed with functionality.
- Routing, fees, FX, times, amounts and any backend data are never modified
  from this repository: the website only presents what the API returns.
