import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/QuizoForStudents/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173/QuizoForStudents/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
