import { expect, test } from '@playwright/test'

// Google Tag Manager is intercepted so the test never contacts Google; we only
// assert WHETHER the browser attempted to load it. This exercises the real CSP
// (which allows googletagmanager.com for gtag.js) and the real consent gate.
async function trackGtm(page: import('@playwright/test').Page): Promise<string[]> {
  const requested: string[] = []
  await page.route('https://www.googletagmanager.com/**', (route) => {
    requested.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* intercepted gtag.js */',
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
  expect(gtm[0]).toContain('id=G-PNQWWXSPZX')
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

test('consent can be withdrawn from Privacy choices; analytics is not reloaded', async ({
  page,
}) => {
  const gtm = await trackGtm(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect.poll(() => gtm.length).toBeGreaterThan(0)
  const afterAccept = gtm.length

  // Permanent footer control re-opens the preferences.
  await page.getByRole('button', { name: 'Privacy choices' }).click()
  const dialog = page.getByRole('dialog', { name: 'Analytics consent' })
  await expect(dialog).toBeVisible()

  // Withdraw → the page reloads and analytics is NOT requested again.
  await page.getByRole('button', { name: 'Withdraw consent' }).click()
  await page.waitForLoadState('load')
  await expect(
    page.getByRole('dialog', { name: 'Analytics consent' }),
  ).toBeHidden()
  await page.waitForTimeout(400)
  expect(gtm.length).toBe(afterAccept)
})

test('Privacy choices is keyboard reachable and named', async ({ page }) => {
  await page.goto('/')
  // Dismiss the first-run banner so it doesn't overlap the footer control.
  await page.getByRole('button', { name: 'Reject' }).click()

  const control = page.getByRole('button', { name: 'Privacy choices' })
  await control.focus()
  await expect(control).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'Analytics consent' }),
  ).toBeVisible()
})
