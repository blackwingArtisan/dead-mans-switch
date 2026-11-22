import { defineConfig, devices } from '@playwright/test';

// Smoke test against the deployed static demo, kept apart from the main suite so `npm run check`
// never depends on the network. Run with `npm run smoke:live`; set LIVE_URL to test another deploy.
const LIVE_URL = process.env.LIVE_URL ?? 'https://dead-mans-switch-ce1.pages.dev';

export default defineConfig({
  testDir: 'tests/live',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: { baseURL: LIVE_URL, reducedMotion: 'reduce' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
