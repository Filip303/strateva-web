# Textual wireframes — Simulator (v1)

> Simulation only. The "Strateva does not execute, custody or move funds"
> disclaimer **always** accompanies the CTA and the results. All data comes
> from the public HTTP contract.

Low-fidelity wireframes (structure only, no design). They cover desktop and
mobile, the simulator form, the loading state, the recommended result with
alternatives, the per-leg breakdown and the error states (404, 422, 429, 5xx
and timeout). All interface copy is **English-only**.

Legend: `[ ]` field, `( )` control/button, `▸` collapsible element, `···`
repeatable. Names inside `{ }` are real contract fields (see
`API_UI_MAPPING.md`). The currencies in the examples (EUR, MXN) come from the
selected corridor (`source_currency` / `destination_currency`), never from
hardcoded values.

---

## 1. Simulator — desktop (two columns)

```
┌──────────────────────────────────────────────────────────────┐
│  Strateva Payment Router · Simulator                          │
│  ⚠ Simulation only. No real money moves.                      │
├───────────────────────────┬──────────────────────────────────┤
│  FORM                     │  RESULTS                           │
│                           │                                    │
│  Corridor                 │  (empty at start: guide text       │
│  [ EUR → MXN        ▾ ]   │   "Fill in the form and press      │
│   (options from API)      │    Compare routes")                │
│                           │                                    │
│  Amount                   │                                    │
│  [ 1000        ] EUR      │                                    │
│                           │                                    │
│  Objective                │                                    │
│  ( ) Prioritize cost      │                                    │
│  ( ) Prioritize speed     │                                    │
│  ( ) Prioritize reliab.   │                                    │
│  (•) Balanced             │                                    │
│                           │                                    │
│  ▸ Advanced options       │                                    │
│    (limits: max cost,     │                                    │
│     max time, min         │                                    │
│     reliability, excl.)   │                                    │
│                           │                                    │
│  ( Compare routes )       │                                    │
│  ⚠ Simulated result.      │                                    │
└───────────────────────────┴──────────────────────────────────┘
```

- "Corridor" is populated from `GET /api/v1/corridors` (never hardcoded).
- Amount currency = `source_currency` of the selected corridor.
- The objective labels ("Prioritize cost", "Prioritize speed", "Prioritize
  reliability", "Balanced") map to the fixed enum
  `cheapest`/`fastest`/`most_reliable`/`balanced` (the API offers no
  objectives-metadata endpoint; see `API_UI_MAPPING.md`).
- "Advanced options" maps to `maximum_cost_percentage`,
  `maximum_conservative_time_minutes`, `minimum_reliability`,
  `excluded_providers`, `excluded_networks`.
- Allowed CTA: **"Compare routes"** (alternative: "Simulate route"). The
  disclaimer sits right next to the CTA.

## 2. Simulator — mobile (single column, stacked)

```
┌─────────────────────────┐
│ Strateva · Simulator    │
│ ⚠ Simulation only.      │
├─────────────────────────┤
│ Corridor [ EUR→MXN ▾ ]  │
│ Amount   [ 1000 ] EUR   │
│ Objective               │
│  (•) Balanced ▾         │
│ ▸ Advanced options      │
│ ( Compare routes )      │
│ ⚠ Simulated result.     │
├─────────────────────────┤
│ RESULTS (below)         │
│  … (after submitting)   │
└─────────────────────────┘
```

On mobile the results render **below** the form; focus jumps to the results
block when the call completes. The objective selector expands to the four
labels ("Prioritize cost", "Prioritize speed", "Prioritize reliability",
"Balanced").

---

## 3. Loading state

```
┌──────────────────────────────────────┐
│ RESULTS                               │
│  ⏳ Comparing simulated routes…       │
│  [░░░░░░░░░  ] (indeterminate)        │
│  (the button stays disabled)          │
└──────────────────────────────────────┘
```

- Shown while `POST /api/v1/routes/quote` is in flight.
- Button disabled to prevent duplicate submissions.
- A client-side **timeout** must exist (see the Timeout state).

---

## 4. Result — recommended route + alternatives

```
┌────────────────────────────────────────────────────────────────┐
│ RESULTS                                                        │
│ ⚠ Simulated result. Nothing is executed or sent.               │
│ Sent: {sent_amount} EUR → MXN · Objective: Balanced            │
│ Recommended route valid until: {quote_expires_at}              │
│                                                                │
│ ┌─ RECOMMENDED ─────────────────────────────────────────┐  │
│ │ Receives (approx.): {estimated_received_amount} MXN      │  │
│ │ Total cost: {total_cost} MXN ({total_cost_percentage} %) │  │
│ │ Effective FX rate (simulated): {effective_fx_rate}       │  │
│ │   MXN per EUR                                            │  │
│ │ Expected time: {expected_time_seconds}                   │  │
│ │ Conservative time: {conservative_time_seconds}           │  │
│ │ Fiat available in ~: {time_to_fiat_available_seconds}    │  │
│ │ Reliability: {reliability_score}                         │  │
│ │ 24/7: {operates_24_7 ? "Yes" : "No"}                     │  │
│ │ Expires: {expires_at}                                    │  │
│ │ Why: {explanation}                                       │  │
│ │ ⚠ {warnings…}                                            │  │
│ │ ▸ View leg breakdown                                     │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ Alternatives — each with its own expiry {expires_at}           │
│ ┌─ Alternative #1 ──────────────────────────────────────┐ ··· │
│ │ Receives ~ {estimated_received_amount} MXN           │     │
│ │ Cost {total_cost} MXN ({total_cost_percentage} %)    │     │
│ │ Time · Reliability · Expires: {expires_at}           │     │
│ │ ⚠ {warnings…}  ▸ View leg breakdown                  │     │
│ └────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

- Names inside `{ }` are real fields of `PublicRouteResult` / `QuoteResponse`
  (see `API_UI_MAPPING.md`). No figure the API does not return is shown, and
  **no financial figure appears without its currency/asset**.
- `{quote_expires_at}` is the **effective validity of the recommended route**
  (the minimum of its own expiry and the server TTL). Every route — including
  every alternative — has its **own** `{expires_at}`; the wireframe must not
  suggest that all of them expire at `quote_expires_at`.
- "Effective FX rate (simulated)" = `estimated_received_amount / sent_amount`,
  the end-to-end effective rate after all costs; it is **not** a real market
  rate.
- Times are presented readably but honestly: "conservative", never "p95" (see
  `TERMINOLOGY_AND_COPY.md`).
- Every route with on-chain steps carries its simulated-data warning.

---

## 5. Leg breakdown (collapsible inside each route)

Units per leg: `fixed_fee` and `percentage_fee_amount` in the **input** asset
(`source_node.asset`); `spread_cost` in the **output** asset
(`destination_node.asset`); `amount_in` / `amount_out` in input / output.

```
▾ Leg breakdown
 ┌ Leg 0 · sepa_transfer · mock_sepa ─────────────────┐
 │ EUR (ES, sepa) → EUR (ES, provider_internal)       │
 │ In 1000.00 EUR → Out 1000.00 EUR                   │
 │ Fixed fee 0 EUR · % fee 0 EUR · spread 0 EUR        │
 │ Time ~3600 s · Reliability 0.995                   │
 └────────────────────────────────────────────────────┘
 ┌ Leg 2 · fx_conversion · mock_globalremit ─────────┐ ···
 │ EUR (provider_internal) → MXN (provider_internal)  │
 │ In 999.50 EUR → Out 19344.34 MXN                   │
 │ Fixed fee 0 EUR · % fee 4.50 EUR ·                  │
 │ spread 58.21 MXN                                   │
 │ Time ~600 s · Reliability 0.99                     │
 └────────────────────────────────────────────────────┘
 (optional in UI) Per-leg latency, from `latency_legs`:
   component · expected/conservative · availability ·
   public provenance (observed / declarative / fallback) ·
   confirmation target (included/safe/finalized) —
   NOT fiat availability.
```

- Per-leg fields = `RouteStep` (position, source/destination node, provider,
  operation_type, fixed_fee, percentage_fee_amount, spread_cost,
  estimated_time_seconds, reliability_score, amount_in, amount_out).
- Per-leg latency uses `latency_legs` (a required API field; showing it is a
  UI decision): component, expected/conservative, availability,
  `latency_source` (`observed`/`declarative`), `provenance`
  (`observed`/`declarative`/`fallback`), confirmation_target, fallback_reason.
  The public DTO carries **no** `source` field and no per-leg "synthetic"
  value.

---

## 6. Error states

All of them render in the results block, keeping the form and the disclaimer.
The text is human; raw technical detail is not exposed.

### 6.1 · 404 — corridor not modelled
```
┌ RESULTS ────────────────────────────────────────┐
│ ⚠ That corridor is not available in the          │
│   simulation. Pick another from the list.        │
│ ( Choose another corridor )                      │
└─────────────────────────────────────────────────┘
```
Source: `POST /api/v1/routes/quote` → 404 (corridor not modelled) or corridor
missing from `GET /api/v1/corridors`.

### 6.2 · 422 — invalid input or no viable route
```
┌ RESULTS ────────────────────────────────────────┐
│ ⚠ No route satisfies the request, or some       │
│   input is invalid.                              │
│   {readable detail: e.g. "amount must be         │
│    greater than 0" or "no route within your      │
│    limits"}                                      │
│ ( Adjust amount / objective / limits )           │
└─────────────────────────────────────────────────┘
```
Source: form validation or a backend 422 (invalid input or no route within the
guardrails).

### 6.3 · 429 — too many requests
```
┌ RESULTS ────────────────────────────────────────┐
│ ⚠ Too many simulations in a row. Wait a moment  │
│   and try again.                                 │
│ ( Retry ) — disabled for the time indicated      │
│   by the Retry-After header                      │
└─────────────────────────────────────────────────┘
```
Source: backend rate limiting. **Mandatory**: read and honor the `Retry-After`
response header — the retry button stays disabled for that long. Retrying is
always **manual** (pressed by the user); never an automatic retry loop.

### 6.4 · 5xx — server error / market data unavailable
```
┌ RESULTS ────────────────────────────────────────┐
│ ⚠ The simulation is unavailable right now.       │
│   Try again in a moment.                         │
│ ( Retry )                                        │
└─────────────────────────────────────────────────┘
```
Source: 500/502/503 (incl. 503 "market data temporarily unavailable" / "quote
expired before it could be served"). Generic message; no technical traces.
Manual retry.

### 6.5 · Timeout — no response in time
```
┌ RESULTS ────────────────────────────────────────┐
│ ⚠ The simulation took too long. This may be      │
│   temporary.                                     │
│ ( Retry )                                        │
└─────────────────────────────────────────────────┘
```
Source: the client-side timeout elapses before a response arrives. The request
is cancelled and a (manual) retry is offered.
