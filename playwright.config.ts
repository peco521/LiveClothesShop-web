import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const apiRoot = path.resolve(__dirname, '../LiveClothesShop-api');
const python = path.join(apiRoot, '.venv', 'Scripts', 'python.exe');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4201',
    trace: 'on',
    ...devices['Desktop Chrome'],
    launchOptions: { channel: 'chrome' },
  },
  webServer: [
    {
      command: `"${python}" "${path.join(apiRoot, 'scripts', 'serve_test_api.py')}" --port 8002`,
      url: 'http://127.0.0.1:8002/health',
      // Reuse the API server so that test.afterEach cleanup can reach it.
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run start -- --host localhost --port 4201',
      url: 'http://localhost:4201/saas/login',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
