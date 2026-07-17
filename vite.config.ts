import react from '@vitejs/plugin-react'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'
import { PAGE_META, renderRouteHtml } from './src/lib/meta'

/**
 * Emit one static HTML file per public route (dist/<route>/index.html) so
 * the INITIAL HTML already carries that route's title, description,
 * canonical, Open Graph and Twitter tags before any JavaScript executes.
 * PAGE_META in src/lib/meta.ts stays the single source of truth; asset URLs
 * in index.html are root-absolute, so nested copies resolve identically.
 * Unknown paths still fall back to the SPA index (a real HTTP 404 status is
 * a hosting concern and is deliberately not claimed here).
 */
function perRouteHtml(): Plugin {
  const distDir = fileURLToPath(new URL('./dist', import.meta.url))
  return {
    name: 'strateva-per-route-html',
    closeBundle() {
      const template = readFileSync(join(distDir, 'index.html'), 'utf8')
      for (const meta of PAGE_META) {
        const html = renderRouteHtml(template, meta)
        const outPath =
          meta.path === '/'
            ? join(distDir, 'index.html')
            : join(distDir, ...meta.path.slice(1).split('/'), 'index.html')
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, html)
      }
    },
    // `vite preview` alone would SPA-fall-back extensionless paths like
    // /simulator to the root index.html. Rewrite them to the generated
    // per-route file when it exists — the same extensionless → index.html
    // mapping any standard static host performs — so the raw-HTML e2e
    // regression exercises the canonical URLs. Hosting must do the same.
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname && pathname !== '/' && !pathname.includes('.')) {
          const trimmed = pathname.replace(/\/+$/, '')
          const candidate = join(
            distDir,
            ...trimmed.slice(1).split('/'),
            'index.html',
          )
          if (existsSync(candidate)) {
            req.url = `${trimmed}/index.html`
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), perRouteHtml()],
  build: {
    // Production bundles ship no source maps (verified by verify:dist).
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
