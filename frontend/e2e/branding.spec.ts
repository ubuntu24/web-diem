import { test, expect } from '@playwright/test';

test('has branding title "HẸ HẸ"', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/HẸ HẸ/);
});
