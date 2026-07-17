# API ↔ UI mapping — Strateva Web (v1)

> Simulation only. This document maps the backend's **real public HTTP
> contract** to the website's visual components. It invents no fields and no
> corridors.

## Source of the contract

- Public backend repository: `Filip303/strateva-payment-router`.
- Reference commit (deployed contract):
  **`a697ca08348d0f1ec19bcb715c7a54ce6dff625f`**.
- Authoritative schema definitions (read from that commit):
  - `backend/src/strateva/api/routes.py` (endpoints and status codes),
  - `backend/src/strateva/api/schemas.py` (HTTP schemas),
  - `backend/src/strateva/api/public.py` (public route projection).
- **The only source of truth for the fields is the schema code at that
  commit.** See the *gap* note about `examples/quote-response.json` at the
  end.

General rule: the website **only** renders fields present in these schemas. If
a piece of data is missing, it is flagged as a *gap* (pending in the API),
never invented.

### Required fields vs. optional display

This document explicitly distinguishes two things that must not be confused:

- **"Required in the API"**: the backend schema always delivers the field.
- **"The UI may choose not to show it"**: a presentation decision of the
  component; the field still arrives in the response.

Wherever a note says "UI: optional to display" it means the latter, never that
the field can be missing from the contract.

---

## Endpoints consumed by v1

| Method | Path                          | Use in the website                             |
|--------|-------------------------------|-------------------------------------------------|
| GET    | `/api/v1/corridors`           | Populate the corridor selector.                 |
| GET    | `/api/v1/corridors/{id}`      | Corridor detail (families, pairs, networks).    |
| POST   | `/api/v1/routes/quote`        | Simulate and compare routes.                    |
| GET    | `/health`                     | (Optional for the UI) service status.           |

`/ready`, `/api/v1/providers` and `/api/v1/providers/health` exist in the
backend but are **not** needed for the v1 UI (internal/diagnostic use).

---

## 1) `GET /api/v1/corridors` → corridor selector

Response: list of `CorridorInfo`.

| API field                | Type   | UI component                                   |
|--------------------------|--------|-------------------------------------------------|
| `corridor_id`            | string | internal value of the selector option.          |
| `origin_country`         | string | ISO origin-country code (label/flag).           |
| `destination_country`    | string | ISO destination-country code.                   |
| `source_currency`        | string | currency of the amount field.                   |
| `destination_currency`   | string | currency of the received result.                |

- The selector is built **entirely** from this response. EUR→MXN and GBP→EUR
  are not hardcoded in the frontend; they appear because the API returns them.
- **Gap:** the API returns no human-readable corridor or currency names (ISO
  codes only). The visible label ("EUR → MXN") is composed client-side from
  the codes; any "pretty" name is UI presentation, not backend data.

## 2) `GET /api/v1/corridors/{id}` → corridor detail

Response: `CorridorDetail`.

| API field             | UI component                                             |
|-----------------------|----------------------------------------------------------|
| `corridor_id`         | title/identifier.                                        |
| `origin_country` / `destination_country` | corridor header.                       |
| `source_currency` / `destination_currency` | corridor header.                     |
| `simulation_only`     | reinforces the disclaimer (always `true`).               |
| `market_pairs`        | list of market pairs (e.g. `EURMXN`).                    |
| `route_families[]`    | "route family" cards.                                    |

Each `route_families[]` = `RouteFamilyInfo`:

| Field                     | UI component                                         |
|---------------------------|------------------------------------------------------|
| `family_id`               | family card id.                                       |
| `label`                   | readable family title.                                |
| `enabled`                 | available / unavailable badge.                        |
| `simulated`               | "simulated" badge (always true).                      |
| `required_provider`       | "requires provider X" note (or none).                 |
| `providers[]`             | provider chips.                                       |
| `networks[]`              | network chips (e.g. `sepa`, `base`, `spei`).          |
| `operations[]`            | operation sequence (`type:asset->asset`).             |
| `chain_confirmations[]`   | per on-chain leg: `edge_id` + `confirmation_target`.  |
| `offramp_acceptances[]`   | per off-ramp: `minimum_confirmation_target`, `simulated`. |

- `confirmation_target` ∈ {`included`, `safe`, `finalized`}. It is a
  **chain-confirmation target**, **not** fiat availability (see terminology).

## 3) `POST /api/v1/routes/quote` → simulator

### 3.1 Request — `QuoteRequestBody`

| API field                            | Form control                                 | Rules |
|--------------------------------------|----------------------------------------------|--------|
| `origin_country`                     | derived from the selected corridor           | 2 letters |
| `destination_country`                | derived from the selected corridor           | 2 letters |
| `source_currency`                    | derived from the selected corridor           | 3 letters |
| `destination_currency`               | derived from the selected corridor           | 3 letters |
| `amount`                             | amount field                                 | > 0 |
| `objective`                          | objective selector                           | fixed enum: `cheapest`/`fastest`/`most_reliable`/`balanced` (default `balanced`) |
| `maximum_time_minutes`               | advanced option (optional in the request)    | > 0 |
| `maximum_cost_percentage`            | advanced option (optional in the request)    | > 0, ≤ 100 |
| `maximum_conservative_time_minutes`  | advanced option (optional in the request)    | > 0 |
| `minimum_reliability`                | advanced option (optional in the request)    | 0.0–1.0 |
| `excluded_providers[]`               | advanced option (optional in the request)    | list |
| `excluded_networks[]`                | advanced option (optional in the request)    | list |

- The four country/currency fields are **not** free inputs: they derive from
  the selected corridor (which comes from the API).
- `objective` is a **fixed enum of the public contract**: the API offers no
  metadata endpoint that enumerates the objectives, so the frontend implements
  and validates exactly those four values. Only corridors are discovered
  dynamically. (See *gaps*.)

### 3.2 Response — `QuoteResponse`

Every field is required in the contract.

| API field              | UI component                                             |
|------------------------|----------------------------------------------------------|
| `disclaimer`           | simulation banner next to the results.                   |
| `simulation_only`      | reinforces the disclaimer (always `true`).               |
| `generated_at`         | generation timestamp (UI: optional to display).          |
| `quote_expires_at`     | "Recommended route valid until…" (see expiry note).      |
| `sent_amount`          | "Sent: … {source_currency}".                             |
| `source_currency`      | currency sent.                                           |
| `destination_currency` | currency received.                                       |
| `objective`            | applied objective (echo of the chosen one).              |
| `recommended_route`    | **RECOMMENDED** card (see 3.3).                          |
| `alternative_routes[]` | alternative cards (see 3.3).                             |
| `warnings[]`           | response-level warnings.                                 |
| `provider_failures[]`  | **always-present, possibly empty** list of provider failures; UI: optional to display. |

**Expiry:** `quote_expires_at` is the **effective validity of the recommended
route** — the minimum of that route's own expiry (provider quotes and market
snapshot) and the server TTL. It does **not** describe the alternatives:
**every route**, alternatives included, carries its own `expires_at` (see
3.3), and the UI must not suggest they all expire at once.

### 3.3 Route — `PublicRouteResult` (recommended and each alternative)

Every field is **required in the contract**; where it says "UI: optional to
display" that is a presentation decision, not a possible absence of the field.

| API field                         | UI component                                     |
|-----------------------------------|--------------------------------------------------|
| `route_id`                        | internal card id.                                 |
| `simulation_only`                 | reinforces the disclaimer.                        |
| `steps[]`                         | leg breakdown (see 3.4).                          |
| `total_cost`                      | "Total cost" — **denominated in `destination_currency`**. |
| `total_cost_percentage`           | "Total cost (%)" — percentage.                    |
| `total_time_seconds`              | total time (= expected).                          |
| `expected_time_seconds`           | "Expected time".                                  |
| `conservative_time_seconds`       | "Conservative time" (NOT "p95").                  |
| `time_to_fiat_available_seconds`  | "Fiat available in ~" (time until usable fiat).   |
| `latency_breakdown[]`             | required in the API; per-component times (UI: optional to display). |
| `latency_legs[]`                  | required in the API; per-leg latency (see 3.5) (UI: optional to display). |
| `operates_24_7`                   | "24/7: Yes/No" badge.                             |
| `effective_fx_rate`               | "Effective FX rate (simulated)" — end-to-end effective rate (see "Currencies and units"). |
| `estimated_received_amount`       | "Receives (approx.) … {destination_currency}".    |
| `reliability_score`               | "Reliability".                                    |
| `objective_score`                 | required in the API; objective score (UI: optional to display). |
| `expires_at`                      | expiry **of this route** (also on every alternative); basis of `quote_expires_at` for the recommended one. |
| `explanation`                     | "Why this route is recommended".                  |
| `warnings[]`                      | route warnings (e.g. simulated on-chain data).    |

### 3.4 Leg — `RouteStep` (inside `steps[]`)

| API field                 | UI component                                    |
|---------------------------|-------------------------------------------------|
| `position`                | leg order.                                       |
| `source_node`             | source node (asset, network, country, account…). |
| `destination_node`        | destination node.                                |
| `provider`                | leg provider.                                    |
| `operation_type`          | operation type (sepa_transfer, fx_conversion, onramp, offramp, bridge, local_payout, swift_transfer…). |
| `fixed_fee`               | fixed fee — **denominated in `source_node.asset`** (the leg's input asset). |
| `percentage_fee_amount`   | percentage fee (amount) — **denominated in `source_node.asset`**. |
| `spread_cost`             | FX spread cost — **denominated in `destination_node.asset`** (the leg's output asset). |
| `estimated_time_seconds`  | leg time.                                        |
| `reliability_score`       | leg reliability.                                 |
| `amount_in` / `amount_out`| "in / out" per leg — in `source_node.asset` / `destination_node.asset` respectively. |

### 3.5 Per-leg latency — `PublicLatencyLeg` (inside `latency_legs[]`)

| API field              | UI component                                        |
|------------------------|-----------------------------------------------------|
| `position` / `edge_id` | leg identification.                                  |
| `provider`             | provider.                                            |
| `component`            | component (FUNDING, ONRAMP, CHAIN_CONFIRMATION, BRIDGE, OFFRAMP, FIAT_PAYOUT, BANK_SETTLEMENT). |
| `confirmation_target`  | included/safe/finalized (on-chain leg only). **Not** fiat availability. |
| `expected_seconds`     | leg expected time.                                   |
| `conservative_seconds` | leg conservative time.                               |
| `availability`         | `continuous` / `banking_hours`.                      |
| `basis`                | `operational_duration` (today) / `calendar_elapsed` (reserved). |
| `latency_source`       | **only** `observed` or `declarative`.                |
| `provenance`           | **only** `observed`, `declarative` or `fallback`.    |
| `fallback_reason`      | stable code (when `provenance = fallback`: observed evidence existed, was rejected, and the declarative times were kept). |
| `as_of` / `valid_until`| dates of the observed evidence (only on `observed` legs). |

- The public DTO exposes **no** `source` field: the internal distinction
  between synthetic and contractual latency **does not cross the public
  boundary**, and the UI must not invent it or show "synthetic" as a per-leg
  value.

---

## Currencies and units (mandatory in the UI)

No financial figure is shown without its currency or asset:

- `total_cost` → in the response's **`destination_currency`**.
- `estimated_received_amount` → in `destination_currency`.
- `sent_amount` → in `source_currency`.
- Per leg: `fixed_fee` and `percentage_fee_amount` → in
  **`source_node.asset`** (the leg's input asset); `spread_cost` → in
  **`destination_node.asset`** (the output asset); `amount_in` / `amount_out`
  → in the input / output asset respectively.
- `total_cost_percentage` → percentage (stays a %).
- `effective_fx_rate` → presented as the **simulated end-to-end effective
  rate**: `estimated_received_amount / sent_amount`, i.e. destination units
  per origin unit **after all costs**. It is **not** a real market rate and
  not a mid rate; copy must not present it as such.

Visual formatting (separators, symbol, display rounding) is the UI's
responsibility and must not alter the received figure.

---

## Time distinctions (mandatory in the UI)

The backend exposes **three** distinct time magnitudes; the website must not
confuse them or substitute one for another:

1. **Expected time** (`expected_time_seconds`) — sum of per-leg expected
   times; the "typical" time.
2. **Conservative time** (`conservative_time_seconds`) — sum of per-leg
   conservative bounds. A prudent bound, **not** a p95 (the p95 of a sum is
   not the sum of p95s). Label: "conservative".
3. **Fiat available** (`time_to_fiat_available_seconds`) — the (conservative)
   time until the receiver holds **spendable fiat** in their destination bank.
   Chain confirmation is **not** fiat availability: a route with a fast
   blockchain but a slow off-ramp reports the off-ramp/payout time here.

`operates_24_7` says whether **all** legs run on continuous rails; it is a
descriptive flag, not a calendar/holiday computation.

---

## Contract validation in the frontend (future)

The backend's example JSON **does not modify the contract**: the source of
truth is the schema code at the reference commit. Once code exists, the
frontend will validate responses against the contract: if a real response were
missing a **required** field (e.g. `latency_legs` or `objective_score`),
validation must **fail safe** and show the sanitized error state — never
accept the response as valid or render partial data.

---

## Gaps (what the API does NOT provide yet)

Explicitly flagged as *gaps*, never presented as existing data:

- **No objectives-metadata endpoint**: the API exposes no endpoint to discover
  the optimization objectives. The frontend implements and validates the four
  exact values of the public enum (`cheapest`, `fastest`, `most_reliable`,
  `balanced`); only corridors are fetched dynamically.
- **Readable names**: the API returns ISO country/currency codes and corridor
  ids, but **no** human-readable corridor or currency names. The UI composes
  them; they are not backend data.
- **Outdated example (does not alter the contract)**:
  `examples/quote-response.json` (in the backend repo, at this commit) lacks
  `expected_time_seconds`, `conservative_time_seconds`,
  `time_to_fiat_available_seconds`, `latency_breakdown`, `latency_legs` and
  `operates_24_7`, even though the `PublicRouteResult` schema **does** declare
  them as required at the same commit. The schema code rules; the example JSON
  is stale and does not weaken the contract. If a real response violated the
  schema, the fail-safe validation described above applies.
- **No real variance**: today `conservative_seconds` usually equals
  `expected_seconds` (no per-leg distributions). There is no percentile field;
  "p95" must not be displayed.
- **Availability is not a calendar**: `availability`
  (`continuous`/`banking_hours`) is descriptive; the times are operational
  durations, **not** calendar ETAs (no holidays, time zones or cut-offs). Do
  not present the times as a natural delivery time.
