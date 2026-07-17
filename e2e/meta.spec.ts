import { expect, test } from '@playwright/test'

test('per-page metadata and focus update on SPA navigation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Strateva Payment Router — Simulation Lab')
  const canonical = page.locator('link[rel="canonical"]')
  await expect(canonical).toHaveAttribute('href', 'https://strateva.ai/')
  // The initial load never steals focus.
  await expect(page.locator('#main-content')).not.toBeFocused()

  await page.getByRole('link', { name: 'Methodology' }).click()
  await expect(page).toHaveTitle('Methodology — Strateva Payment Router')
  await expect(canonical).toHaveAttribute(
    'href',
    'https://strateva.ai/methodology',
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /simulated figures/,
  )
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Methodology — Strateva Payment Router',
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )
  // SPA navigation moves focus accessibly to the main landmark.
  await expect(page.locator('#main-content')).toBeFocused()
  // Indexable pages carry no robots noindex.
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('the 404 page carries robots noindex', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  await expect(page).toHaveTitle('Page not found — Strateva Payment Router')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex',
  )
})

test('static SEO assets are served', async ({ page }) => {
  for (const asset of [
    '/robots.txt',
    '/sitemap.xml',
    '/site.webmanifest',
    '/favicon.svg',
    '/og-image.png',
  ]) {
    const response = await page.request.get(asset)
    expect(response.status(), asset).toBe(200)
  }
  const sitemap = await (await page.request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('https://strateva.ai/simulator')
  expect(sitemap).not.toContain('404')
})
