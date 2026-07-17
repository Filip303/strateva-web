import { expect, test } from '@playwright/test'
import {
  CORRIDOR_OPTION_LABEL,
  corridorsFixture,
  makeQuoteResponse,
} from '../src/test/fixtures'

// All API traffic is intercepted: the e2e suite never reaches a real backend.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/corridors', (route) =>
    route.fulfill({ json: corridorsFixture }),
  )
  await page.route('**/api/v1/routes/quote', (route) =>
    route.fulfill({ json: makeQuoteResponse() }),
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
})

test('corridors page renders the dynamic list from the mocked API', async ({
  page,
}) => {
  await page.goto('/corridors')
  await expect(page.getByRole('heading', { level: 1, name: 'Corridors' })).toBeVisible()
  await expect(page.getByText(CORRIDOR_OPTION_LABEL)).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()
})
