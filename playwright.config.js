import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// E2E full-stack: navegador real → Vite (frontend) → FastAPI → MariaDB de PRUEBAS (se recrea en global-setup).
// Navegador: Edge/Chrome instalado en el sistema (sin descargas). En CI se usa el Chromium de Playwright (E2E_BROWSER_CHANNEL=chromium).
const API_PORT = Number(process.env.E2E_API_PORT ?? 8310)
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5180)
const channel = process.env.E2E_BROWSER_CHANNEL ?? 'msedge'
const useChannel = channel === 'chromium' ? {} : { channel }

export const E2E_ENV = {
  APP_ENV: 'testing',
  JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret-0123456789',
  DATA_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
  DB_HOST: process.env.E2E_DB_HOST ?? '127.0.0.1',
  DB_PORT: process.env.E2E_DB_PORT ?? '3399',
  DB_USER: process.env.E2E_DB_USER ?? 'root',
  DB_PASS: process.env.E2E_DB_PASS ?? '',
  DB_NAME: process.env.E2E_DB_NAME ?? 'optimus_e2e_test',
  CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
  AUTH_RATE_LIMIT: '100000',
  RATE_LIMIT_REQUESTS: '100000',
  E2E_API_PORT: String(API_PORT),
  APP_URL: `http://localhost:${WEB_PORT}`,
  MAIL_OUTBOX_FILE: process.env.E2E_MAIL_OUTBOX ?? path.join(os.tmpdir(), 'optimus-e2e-outbox.jsonl'),
  UPLOAD_DIR: process.env.E2E_UPLOAD_DIR ?? path.join(os.tmpdir(), 'optimus-e2e-uploads'),
}

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-UY', timezoneId: 'America/Montevideo' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...useChannel, viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], ...useChannel }, testIgnore: /a11y|security/ },
  ],
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      cwd: '.',
      url: `http://127.0.0.1:${API_PORT}/healthz`,
      env: E2E_ENV,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_PROXY: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
