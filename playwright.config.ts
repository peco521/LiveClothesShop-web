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
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { channel: 'chrome' },
  },
  webServer: [
    {
      command: `"${python}" "${path.join(apiRoot, 'scripts', 'serve_test_api.py')}"`,
      url: 'http://127.0.0.1:8000/health',
      // Never reuse an API whose database destination was not validated by this run.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run start -- --host localhost --port 4200',
      url: 'http://localhost:4200/saas/login',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
