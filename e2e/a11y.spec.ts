import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  corridorsFixture,
  makeDetailedQuoteResponse,
} from '../src/test/fixtures'

// Automatically detectable WCAG 2.2 A/AA rules (axe tags are cumulative
// across 2.0/2.1/2.2). Zero violations are required on every public route.
const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
]

const ROUTES: ReadonlyArray<readonly [path: string, heading: string]> = [
  ['/', 'Strateva Payment Router'],
  ['/simulator', 'Simulator'],
  ['/how-it-works', 'How it works'],
  ['/corridors', 'Corridors'],
  ['/methodology', 'Methodology'],
  ['/about', 'About'],
  ['/legal/legal-notice', 'Legal notice'],
  ['/legal/privacy', 'Privacy'],
  ['/legal/cookies', 'Cookies'],
  ['/this-route-does-not-exist', 'Page not found'],
]

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/corridors', (route) =>
    route.fulfill({ json: corridorsFixture }),
  )
  await page.route('**/api/v1/routes/quote', (route) =>
    route.fulfill({ json: makeDetailedQuoteResponse() }),
  )
})

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement
    return el ? el.scrollWidth - el.clientWidth : 0
  })
  expect(overflow).toBeLessThanOrEqual(0)
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations).toEqual([])
}

for (const [path, heading] of ROUTES) {
  test(`axe A/AA, no overflow and a title at ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    expect(await page.title()).not.toBe('')
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)
  })
}

test('axe A/AA on the simulator WITH results and disclosures open', async ({
  page,
}) => {
  await page.goto('/simulator')
  await page.getByLabel('Amount (AAA)').fill('250')
  await page.getByRole('button', { name: 'Compare routes' }).click()
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
  const recommended = page.getByRole('region', { name: 'Recommended' })
  await recommended.getByRole('button', { name: 'Leg breakdown' }).click()
  await recommended.getByRole('button', { name: 'Latency detail' }).click()
  await expectNoHorizontalOverflow(page)
  await expectNoAxeViolations(page)
})

test('axe A/AA on the amount validation error state', async ({ page }) => {
  await page.goto('/simulator')
  await page.getByLabel('Amount (AAA)').fill('0')
  await page.getByRole('button', { name: 'Compare routes' }).click()
  await expect(
    page.getByText('Enter an amount greater than zero.'),
  ).toBeVisible()
  const amount = page.getByLabel('Amount (AAA)')
  await expect(amount).toHaveAttribute('aria-invalid', 'true')
  await expect(amount).toHaveAttribute('aria-describedby', 'amount-error')
  await expectNoAxeViolations(page)
})
