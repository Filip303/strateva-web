# Accessibility checklist — manual verification pending

Automated scanning (axe-core via Playwright, WCAG 2.2 A/AA rule tags) runs in
CI on every public route, at five viewport widths, and must report zero
violations. **Automated scanning covers only a fraction of WCAG** — passing
axe is NOT a claim of full WCAG 2.2 AA conformance. The following manual
checks remain pending before any such claim can be made.

## Covered automatically today (axe + explicit tests)

- Labels/fieldsets on every form control; `aria-describedby` + `aria-invalid`
  on amount validation errors; `role="alert"` errors; `aria-live` loading and
  `aria-busy` on the outcome region.
- Focus management: skip link, focus to main content after SPA navigation,
  focus to results/errors after a quote settles, visible focus styles,
  keyboard-toggleable disclosures.
- Color contrast (axe), no horizontal overflow at 320–1280 px widths,
  reduced-motion media query, document language and per-page titles.

## Manual checks still pending

- [ ] Full keyboard-only walkthrough of every flow by a human (no mouse),
      including error recovery and the Retry-After countdown.
- [ ] Screen reader passes: NVDA + Firefox/Chrome (Windows), VoiceOver +
      Safari (macOS/iOS), TalkBack (Android) — announcement quality of the
      loading state, results, errors and disclosures.
- [ ] 200% and 400% browser zoom: reflow without loss of content or
      functionality (WCAG 1.4.10).
- [ ] Windows High Contrast / `forced-colors` mode rendering.
- [ ] Target size of all interactive controls ≥ 24×24 CSS px (WCAG 2.5.8,
      new in 2.2) — verify radio buttons and collapsible toggles.
- [ ] Focus not obscured by sticky elements (WCAG 2.4.11, new in 2.2).
- [ ] Information never conveyed by color alone (manual review of the
      notice, alerts and provenance labels).
- [ ] Plain-language review of error messages and methodology copy.
- [ ] Print stylesheet sanity check (optional).
- [ ] Re-run this checklist after any visual redesign.

WCAG 2.2 criteria not currently applicable (no login, no dragging, no
repeated data entry, no authentication): 2.4.12, 2.5.7, 3.3.7, 3.3.8 — to be
re-evaluated if those features ever appear.
