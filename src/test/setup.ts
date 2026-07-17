import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// A valid public API URL so the client's config validation passes in tests.
vi.stubEnv('VITE_API_URL', 'http://localhost:8000')

beforeEach(() => {
  // Block ALL real network access in unit tests. The default stub never
  // resolves (queries stay pending); tests that need responses install
  // their own fetch mock. No test may reach the backend or the Internet.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<never>(() => {})),
  )
})
