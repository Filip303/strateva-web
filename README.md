# Strateva Payment Router — Web

> ⚠️ **Simulation only. Strateva does not execute, custody, convert or
> transmit anyone's funds.**
>
> This website is a public, demonstrative laboratory. It moves no real money,
> holds no keys, connects to no real providers or wallets, performs no KYC and
> is not an authorized financial service. Every provider, fee, FX rate, time
> and reliability figure shown is **synthetic**.

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

This phase is **documentation-first**: the functional contract of the website
is defined before any React is written. There is **no** application code,
`package.json`, dependency, component or deployment configuration yet.

The product documentation lives in `docs/` (product contract, sitemap,
textual wireframes, API-to-UI mapping and terminology).

## Contribution rules

The rules for contributing (human and automated) are in
[`AGENTS.md`](./AGENTS.md). In short: the website only consumes the public
HTTP contract, never imports anything from the private backend repository,
contains no secrets, ships English-only visible copy in v1, and every PR is
opened as a draft with no deploy.

## License

To be defined.
