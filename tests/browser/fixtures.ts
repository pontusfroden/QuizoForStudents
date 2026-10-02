import { test as base } from '@playwright/test';
export { expect } from '@playwright/test';
// Browser tests use explicit AI mocks; never consume the developer's local model.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('http://127.0.0.1:3001/api/**', (route) => route.abort());
    await use(page);
  },
});
