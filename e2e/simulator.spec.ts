import { expect, test } from '@playwright/test'
import {
  CORRIDOR_OPTION_LABEL,
  corridorsFixture,
  makeDetailedQuoteResponse,
} from '../src/test/fixtures'

// All API traffic is intercepted: the e2e suite never reaches a real backend.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/corridors', (route) =>
    route.fulfill({ json: corridorsFixture }),
  )
  await page.route('**/api/v1/routes/quote', (route) =>
    route.fulfill({ json: makeDetailedQuoteResponse() }),
  )
})

test('simulates a route end to end against mocked API responses', async ({
  page,
}) => {
  await page.goto('/simulator')

  const corridorSelect = page.getByLabel('Corridor')
  await expect(corridorSelect).toBeVisible()
  await expect(
    corridorSelect.locator('option', { hasText: CORRIDOR_OPTION_LABEL }),
  ).toHaveCount(1)

  await page.getByLabel('Amount (AAA)').fill('250')
  await page.getByRole('button', { name: 'Compare routes' }).click()

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
  // Focus lands on the outcome block when the request settles.
  await expect(page.locator('#quote-outcome')).toBeFocused()

  // Exact figures from the mocked response, with their units.
  await expect(
    page.getByText('Receives (approx.): 4821.07 BBB').first(),
  ).toBeVisible()
  await expect(
    page.getByText('Effective FX rate (simulated): 19.284280 BBB per AAA').first(),
  ).toBeVisible()
  // The alternative shows its OWN expiry.
  const alternative = page.getByRole('region', { name: 'Alternative #1' })
  await expect(alternative).toContainText('Expires: 2026-07-17T11:58:00Z')

  // The persistent simulation notice never disappears.
  await expect(page.locator('.sim-notice')).toBeVisible()

  // Leg breakdown opens via KEYBOARD and shows per-asset amounts.
  const recommended = page.getByRole('region', { name: 'Recommended' })
  const legToggle = recommended.getByRole('button', { name: 'Leg breakdown' })
  await legToggle.focus()
  await page.keyboard.press('Enter')
  await expect(legToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(
    recommended.getByText('In: 250.00 AAA → Out: 4821.07 BBB'),
  ).toBeVisible()
  await expect(recommended.getByText('Spread cost: 3.75 BBB')).toBeVisible()

  // Latency detail shows provenance and the chain-confirmation caveat.
  await recommended.getByRole('button', { name: 'Latency detail' }).click()
  await expect(
    recommended.getByText(/Chain confirmation target: safe/),
  ).toBeVisible()
  await expect(
    recommended.getByText('Fallback reason code: stale'),
  ).toBeVisible()
  await expect(
    recommended.getByText('Observed as of 2026-07-01, valid until 2026-08-01'),
  ).toBeVisible()

  // The results link to the methodology, and it navigates.
  await page
    .getByRole('link', { name: 'How to read these figures — Methodology' })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Methodology' }),
  ).toBeVisible()
})

test('corridors page renders the dynamic list from the mocked API', async ({
  page,
}) => {
  await page.goto('/corridors')
  await expect(page.getByRole('heading', { level: 1, name: 'Corridors' })).toBeVisible()
  await expect(page.getByText(CORRIDOR_OPTION_LABEL)).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()
})
