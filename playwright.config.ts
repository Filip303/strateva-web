import { defineConfig, devices } from '@playwright/test'

// Optional escape hatch for environments that provide a pre-installed
// Chromium build (never required in CI, where `playwright install` runs).
const executablePath = process.env.STRATEVA_CHROMIUM_EXECUTABLE

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Mobile-width smoke: same flows at the smallest supported width.
      name: 'chromium-mobile-width',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } },
    },
  ],
  webServer: {
    // The e2e build points VITE_API_URL at the preview origin itself; every
    // /api/v1/* request is intercepted with page.route fixtures, so the e2e
    // suite performs no external network calls and needs no real backend.
    command:
      'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_API_URL: 'http://127.0.0.1:4173' },
  },
})
