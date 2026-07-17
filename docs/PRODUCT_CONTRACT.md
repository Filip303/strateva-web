# Product contract — Strateva Web (v1)

> **Simulation only. Strateva does not execute, custody, convert or transmit
> funds.** All displayed data (providers, fees, FX, times, reliability) is
> synthetic and comes from a read-only public HTTP contract.

This document records the **approved product decisions** for the first version
of the website. It is the functional contract the React implementation must
respect. It includes no final visual design and no code decisions.

## 1. Identity and positioning

- **Product name:** "Strateva Payment Router".
- **Positioning:** a public **laboratory / simulator** for international
  payment routing. It is not a payment gateway, not a remittance service, not
  an authorized financial service.
- **Honest promise:** show *how the best route is decided* across several
  payment infrastructures (banking, SEPA, SWIFT, providers, FX, stablecoin
  rails) by comparing **cost, time and reliability** over simulated data.

## 2. Approved product decisions

1. **Public website with no sign-up.** No login, accounts, profiles or user
   sessions. Anyone can use the simulator without identifying themselves.
2. **No payments.** Nothing is charged, no money is sent, there is no gateway.
   The website's only verb is *simulate / compare*.
3. **Read-only use of the public contract.** The website consumes exclusively
   the public REST API of the `Filip303/strateva-payment-router` backend. It
   writes no state to the backend.
4. **Data always from the API.** Corridors, routes, fees, times, FX and
   reliability are fetched **at runtime from the API**. None of this is
   hardcoded in the frontend. Explicit exception: the **objectives** are a
   fixed enum of the public contract — the API does not expose them as
   metadata — and the frontend implements and validates them (see §4).
5. **English-only v1.** All visible product content — copy, navigation, URL
   paths, errors, metadata and legal-page labels — is in English. No language
   selector, localized routes or hreflang ship in v1; additional locales are
   outside the initial launch scope.
6. **Simulation explicit across the whole surface.** The "simulation only"
   disclaimer accompanies the CTA and the results; on-chain data is marked as
   simulated.

## 3. Initial corridors

- Target corridors for v1: **EUR→MXN** and **GBP→EUR**.
- Both are **always fetched from the API** (`GET /api/v1/corridors`); the
  website does not assume their existence or their parameters. If the API
  stops exposing one, the website stops offering it. If it exposes more, the
  website can show them without code changes (data-driven behaviour).
- The website **invents no** corridors, market pairs or FX orientation:
  everything comes from the API response.

## 4. Optimization objectives

The simulator lets the user pick the objective the backend uses to rank the
candidate routes. The objectives map 1:1 to the backend's public enum
(`cheapest`, `fastest`, `most_reliable`, `balanced`). None of them
**guarantees** an absolute optimum: except for `fastest`, they are weighted
scores over min-max-normalized values relative to the candidate route set.

| API objective   | Product label (EN)     | Actual backend semantics |
|-----------------|------------------------|---------------------------|
| `cheapest`      | Prioritize cost        | Combined score: 75% cost, 15% time, 10% risk. |
| `fastest`       | Prioritize speed       | Lexicographic order: conservative time to fiat available → expected time → cost → reliability. |
| `most_reliable` | Prioritize reliability | Combined score: 75% risk, 15% cost, 10% time. |
| `balanced`      | Balanced               | Combined score: 45% cost, 30% time, 25% risk (default). |

- **No optimum promises:** copy must not claim that `cheapest` always returns
  "the minimum cost" or that `most_reliable` returns "the maximum
  reliability": they prioritize that dimension inside a combined score. The
  honest labels are **"Prioritize cost"**, **"Prioritize speed"**,
  **"Prioritize reliability"** and **"Balanced"**.
- **Fixed enum, not discoverable via API:** the API provides **no** metadata
  endpoint to discover the objectives. The frontend implements and validates
  exactly these four values of the public enum; only the **corridors** are
  fetched dynamically. (Recorded as a *gap* in `API_UI_MAPPING.md`.)

The default objective is **Balanced** (`balanced`), same as the backend.

## 5. v1 scope (in scope)

- A **simulator**: form (corridor, amount, objective) → call to
  `POST /api/v1/routes/quote` → recommended route + alternatives + breakdown.
- Informational pages: how it works, available corridors, methodology, about,
  and legal pages (legal notice, privacy, cookies).
- Error and loading states treated as part of the product (not as technical
  details): 404, 422, 429, 5xx and timeout.
- English-only copy for the whole surface.

## 6. Out of scope (explicit)

- Any real money movement: sending, charging, payments, custody, real FX.
- Sign-up, login, user accounts or authentication of any kind.
- Wallets, chain connections, on-chain signing.
- Firebase, Supabase or any backend-as-a-service; analytics or tracking.
- Persisting amounts or responses in the browser (`localStorage` or others).
- KYC/AML, real prices, real provider integrations in production.
- CTAs that imply executing money ("Send money", "Pay", "Transfer now").
- Additional locales, language selector, localized routes, hreflang (future
  localization is out of scope for v1).
- Final visual design decisions, styling framework choice, hosting
  configuration and deployment workflows (decided later).

## 7. Principles the implementation must respect

- **Data honesty:** never show a figure the API does not return; never present
  synthetic data as observed; never use "p95" except for a real observed
  statistic (see `TERMINOLOGY_AND_COPY.md`).
- **Units always visible:** no financial figure is shown without its currency
  or asset (see "Currencies and units" in `API_UI_MAPPING.md`).
- **Data-driven:** corridors and route fields derive from the API; the
  objectives are the fixed public-contract enum, validated in the frontend.
- **Auditability:** small changes, one purpose per PR, always as a draft.
- **Clean boundary:** zero dependencies on the private repository; only the
  public HTTP contract (see `AGENTS.md`).
