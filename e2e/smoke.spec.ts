import { expect, test } from '@playwright/test'

const NOTICE =
  'Simulation only. Strateva does not execute, custody or transmit funds.'

test('home renders with the notice and the approved CTA', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Strateva Payment Router' }),
  ).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()
  await expect(page.locator('.sim-notice')).toHaveText(NOTICE)
  await expect(page.getByRole('link', { name: 'Compare routes' })).toBeVisible()
})

test('navigation reaches the simulator and unknown paths render 404', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Simulator' }).click()
  await expect(page).toHaveURL(/\/simulator$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Simulator' }),
  ).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()

  await page.goto('/this-route-does-not-exist')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Page not found' }),
  ).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()
})

test('keyboard navigation reaches the skip link and main content', async ({
  page,
}) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to content' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})
