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
  // Chromium at the five supported widths. All specs run at every width;
  // Firefox coverage is deferred to the staging rehearsal.
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'chromium-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'chromium-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
    },
    {
      name: 'chromium-320',
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
