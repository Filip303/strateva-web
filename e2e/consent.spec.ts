import { expect, test } from '@playwright/test'

// Google Tag Manager is intercepted so the test never contacts Google; we only
// assert WHETHER the browser attempted to load it. This exercises the real CSP
// (which allows googletagmanager.com) and the real consent gate end to end.
async function trackGtm(page: import('@playwright/test').Page): Promise<string[]> {
  const requested: string[] = []
  await page.route('https://www.googletagmanager.com/**', (route) => {
    requested.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* intercepted GTM */',
    })
  })
  return requested
}

test('analytics load ONLY after the visitor accepts', async ({ page }) => {
  const gtm = await trackGtm(page)
  await page.goto('/')

  const banner = page.getByRole('dialog', { name: 'Analytics consent' })
  await expect(banner).toBeVisible()
  // Nothing analytics-related before a choice.
  await page.waitForTimeout(300)
  expect(gtm).toHaveLength(0)

  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect(banner).toBeHidden()
  await expect.poll(() => gtm.length).toBeGreaterThan(0)
  expect(gtm[0]).toContain('id=GTM-KR2W2R68')
})

test('rejecting consent loads no analytics', async ({ page }) => {
  const gtm = await trackGtm(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Analytics consent' }),
  ).toBeHidden()
  await page.waitForTimeout(300)
  expect(gtm).toHaveLength(0)
})

test('a remembered acceptance re-loads analytics with no banner', async ({
  page,
}) => {
  const gtm = await trackGtm(page)
  await page.addInitScript(() =>
    localStorage.setItem('strateva-analytics-consent', 'granted'),
  )
  await page.goto('/')

  await expect(
    page.getByRole('dialog', { name: 'Analytics consent' }),
  ).toBeHidden()
  await expect.poll(() => gtm.length).toBeGreaterThan(0)
})
