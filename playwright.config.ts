import { defineConfig, devices } from '@playwright/test';

// Override with E2E_PORT when 3142 is taken on this machine.
const PORT = Number(process.env.E2E_PORT ?? 3142);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /smoke|phone/ },
  ],
  webServer: {
    command: 'npm run build && npx tsx src/server/node.ts',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DMS_STORE: 'memory',
      DMS_CLOCK: 'machine',
      DMS_BASE_URL: `http://localhost:${PORT}`,
    },
  },
});
