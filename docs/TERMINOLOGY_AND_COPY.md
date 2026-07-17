# Terminology and copy — Strateva Web (v1)

> Simulation only. The website's language must reflect at all times that
> Strateva **does not execute, custody, convert or transmit funds**. All v1
> copy is **English-only**.

This document fixes what may and may not be said, and defines the key terms
precisely so the copy stays honest and consistent with the backend contract.

## Copy principles

1. **Simulation explicit.** Every text that shows figures is accompanied by (or
   sits within a context making clear) that they are simulated.
2. **No execution language.** Nothing suggests money is moved.
3. **No invented figures.** No metrics, delivery promises or savings the API
   does not return. Every financial figure is shown with its currency or
   asset.
4. **English-only.** All visible copy — interface text, navigation, errors,
   metadata, legal labels — is written in English. No additional locale ships
   in v1; future localization is out of scope.

## Allowed copy

- CTAs: **"Compare routes"**, **"Simulate route"**.
- Verbs: compare, simulate, estimate, show, rank, explain.
- "Simulated result", "synthetic data", "recommended route", "alternatives".
- Objective labels: **"Prioritize cost"**, **"Prioritize speed"**,
  **"Prioritize reliability"**, **"Balanced"**.
- Core UI terms: Corridor, Amount, Objective, Advanced options, Results,
  Recommended, Alternatives, Total cost, Effective FX rate, Expected time,
  Conservative time, Fiat available in, Reliability, Expires, Retry.

## Prohibited copy

- CTAs or verbs that move money: **"Send money"**, **"Pay"**, **"Transfer
  now"**, "wire", "deposit", "withdraw", and any wording suggesting that
  Strateva moves funds.
- Claiming anything is real, executed, settled or custodied.
- Claiming an objective **guarantees** an absolute optimum: `cheapest` does
  not guarantee "the minimum cost" and `most_reliable` does not guarantee
  "the maximum reliability" — they are combined scores that **prioritize**
  that dimension (hence the labels "Prioritize cost", "Prioritize speed",
  "Prioritize reliability" and "Balanced"; exact semantics in
  `PRODUCT_CONTRACT.md` §4).
- Metrics or promises not backed by the API: "the fastest on the market",
  "save X%", "guaranteed", user or volume figures.
- **"p95"**, unless it refers to a **real observed statistic** (none exists
  today; see below). The prudent time is called **"conservative"**.

## Definitions (plain-language)

### Cost
What the route costs end to end: fixed fees, percentage fees and the FX
spread cost. The API returns it as a total amount (`total_cost`,
**denominated in the destination currency**, `destination_currency`) and as a
percentage (`total_cost_percentage`). Per leg, `fixed_fee` and
`percentage_fee_amount` are denominated in the leg's **input** asset
(`source_node.asset`) and `spread_cost` in the **output** asset
(`destination_node.asset`); copy and UI always show those units.

### Effective FX rate (`effective_fx_rate`)
The **simulated end-to-end effective rate**:
`estimated_received_amount / sent_amount` — how many destination-currency
units result per origin-currency unit **after all costs** (fees and spread).
It is **not** a real market rate and not a mid rate: it is the net result of
the simulation and must be presented as such.

### Reliability (`reliability_score`)
A **simulated** score (0–1) of how likely the route is to complete without
incident, aggregated from each leg's reliability. It is synthetic: it does not
reflect any provider's real performance.

### Expected time (`expected_time_seconds`)
The route's **typical** time: the sum of each leg's expected times.

### Conservative time (`conservative_time_seconds`)
A **prudent bound**: the sum of per-leg conservative bounds. It is called
"conservative", **not** "p95", because the p95 of a sum is not the sum of
p95s and there is no per-leg variance data today (it often equals the
expected time).

### Fiat available (`time_to_fiat_available_seconds`)
The (conservative) time until the receiver holds **spendable fiat money** in
their destination bank account. This is the "commercial" speed magnitude.

### Objectives ("Prioritize…")
Except for `fastest`, the objectives are **weighted scores** over values
normalized relative to the candidate set: `cheapest` weighs 75% cost, 15%
time and 10% risk; `most_reliable` weighs 75% risk, 15% cost and 10% time;
`balanced` weighs 45% cost, 30% time and 25% risk. `fastest` orders
lexicographically: conservative time to fiat available, then expected time,
cost and reliability. Copy says "prioritize", never "guarantee".

## Chain confirmation vs. fiat available

A critical distinction the copy must never blur:

- **Confirmation (blockchain)** = an on-chain transaction reaches an assurance
  level: `included` (in a block), `safe` (justified block, still reversible)
  or `finalized` (irreversible). These are **alternative** targets, not
  cumulative stages.
- **Fiat available** = the money is already **spendable in the destination
  bank**.

A fast blockchain does **not** mean fiat is available: after confirmation the
off-ramp and the payout remain. Copy must present chain confirmation as an
intermediate step, never as final receipt.

## "Synthetic" (general description) vs. public per-leg provenance

These are two different planes the copy must not mix:

**1) General description of the model.** The simulator's economic and latency
data is, today, **synthetic**: plausible but invented. "Synthetic" is a
correct general description of the product and may be used in disclaimers,
methodology and global copy.

**2) Public per-leg provenance.** The public DTO exposes **no** `source`
field: the frontend **does not receive** the internal distinction between
synthetic and contractual latency, and must **not invent it** as if it were
visible. What does arrive per leg is:

- `latency_source`: only **`observed`** or **`declarative`**.
- `provenance`: only **`observed`**, **`declarative`** or **`fallback`**.
- `provenance = fallback` means: **observed evidence existed for the leg, it
  was rejected, and the declarative times were kept** (the reason arrives as
  a stable code in `fallback_reason`).

Copy rules:

- Never present "synthetic" as a per-leg value: per leg only
  `observed` / `declarative` / `fallback` exist.
- Never call declarative data "observed". If a leg is `observed`, its dates
  (`as_of` / `valid_until`) may be shown; otherwise it is presented as
  declarative.
- Never invent a visible distinction between "synthetic" and "contractual"
  latency: the public contract does not expose it.

## About "p95"

Do not use "p95" in the UI while the figure is not a **real observed**
statistic. The backend is explicit: it uses "conservative" precisely to avoid
faking a percentile it does not compute. If observed percentiles existed in
the future, they could be labelled as such, with their provenance.

## Language

- All visible copy is **English-only** in v1; no language selector, localized
  routes or hreflang. Future localization is out of scope for this version.
- Numeric data (amounts, rates, times) is **formatted** in the presentation
  layer without altering the values the API returns.
- Technical API identifiers, enum values, endpoint paths, JSON fields,
  environment variables and code symbols are never translated.
