# Sitemap — Strateva Web (v1)

> Simulation only. No page executes, custodies or moves funds. Every page that
> shows data fetches it from the public HTTP contract.

Navigation structure of the first version. All routes are public and reachable
without sign-up. **All URL paths are English-only**: v1 ships no `/es/` or any
other locale prefix, no localized routes and no hreflang.

## Page tree

```
/                     Home
/simulator            Simulator
/how-it-works         How it works
/corridors            Corridors
/methodology          Methodology
/about                About
/legal/legal-notice   Legal notice
/legal/privacy        Privacy
/legal/cookies        Cookies
/404                  Not found (catch-all)
—                     Error state (not a URL; see note)
```

## Pages

### Home (`/`)
Presentation of the laboratory: what Strateva is, a visible simulation
disclaimer, and a prominent shortcut to the simulator. Allowed CTA:
**"Compare routes"** or **"Simulate route"** (never "Send money" / "Pay" /
"Transfer now"). It may summarize the available corridors fetched from the
API, without inventing any.

### Simulator (`/simulator`)
Core of the product. A form (corridor, amount, objective) that calls
`POST /api/v1/routes/quote` and shows the recommended route, the alternatives
and the per-leg breakdown. Contains the loading and error states (see
`WIREFRAMES.md`). The disclaimer accompanies the CTA and the results.

### How it works (`/how-it-works`)
Plain-language explanation of the simulated money's journey: origin → legs
(transfer, FX, on/off-ramp, payout) → fiat available at destination. Clarifies
the difference between chain confirmation and fiat availability. Exposes no
backend internals.

### Corridors (`/corridors`)
List of available corridors fetched from `GET /api/v1/corridors`, with
per-corridor detail from `GET /api/v1/corridors/{id}` (route families, market
pairs, networks). Data-driven: no corridors are hardcoded in the frontend.

### Methodology (`/methodology`)
How routes are scored and ranked (cost/time/reliability, objectives,
normalization relative to the candidate set), and what "expected time",
"conservative time" and "fiat available" mean. Honestly states the
limitations (synthetic data, relative ranking).

### About (`/about`)
Purpose of the project, its portfolio/laboratory nature, link to the public
backend repository. No invented metrics or promises.

### Legal
- **Legal notice** (`/legal/legal-notice`): non-financial nature of the
  service, absence of any movement of funds, limitation of liability.
- **Privacy** (`/legal/privacy`): the website requires no sign-up and persists
  no amounts or responses; which (minimal) data is processed.
- **Cookies** (`/legal/cookies`): v1 has no analytics or tracking; usage is
  declared (expected to be none or strictly technical).

### 404 page (`/404` and catch-all)
"Not found" page for non-existent routes. Offers a way back to Home or to the
Simulator. Keeps the disclaimer and the navigation.

### Error state (transversal, not a URL)
Not a page with its own URL but a **reusable UI state** shown inside the
affected page (mainly the simulator) when the API fails. Covers 422, 429, 5xx
and timeout, plus a functional 404 when the corridor is not modelled. Each
state is detailed in `WIREFRAMES.md`.

## Navigation

- **Header:** links to Home, Simulator, How it works, Corridors, Methodology,
  About.
- **Footer:** legal links (legal notice, privacy, cookies), link to the public
  backend repository and a reminder of the simulation disclaimer.
