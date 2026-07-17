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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('raw initial HTML carries per-route metadata BEFORE JavaScript runs', async ({
  request,
}) => {
  // Plain HTTP fetches of the served HTML — React never executes here.
  const { PAGE_META } = await import('../src/lib/meta')
  for (const meta of PAGE_META) {
    const response = await request.get(meta.path)
    expect(response.status(), meta.path).toBe(200)
    const html = await response.text()
    expect(html, meta.path).toContain('lang="en"')
    expect(html, meta.path).toContain(`<title>${meta.title}</title>`)
    // The description meta spans multiple lines in the built HTML.
    expect(html, meta.path).toMatch(
      new RegExp(
        `name="description"\\s+content="${escapeRegExp(meta.description)}"`,
      ),
    )
    expect(html, meta.path).toContain(
      `rel="canonical" href="https://strateva.ai${meta.path}"`,
    )
    expect(html, meta.path).toContain(
      `property="og:title" content="${meta.title}"`,
    )
    expect(html, meta.path).toContain(
      `property="og:url" content="https://strateva.ai${meta.path}"`,
    )
    expect(html, meta.path).toContain(
      `name="twitter:title" content="${meta.title}"`,
    )
  }
})

test('JS and CSS assets load correctly from a direct nested route', async ({
  page,
}) => {
  // Deep-link into a nested path: the per-route HTML must reference
  // root-absolute assets so React still mounts and renders.
  await page.goto('/legal/privacy')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy' }),
  ).toBeVisible()
  await expect(page.locator('.sim-notice')).toBeVisible()
})
