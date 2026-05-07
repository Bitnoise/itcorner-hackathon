import { expect, test } from '@playwright/test';

test('root page calls /health and renders "API: ok"', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('API: ok')).toBeVisible({ timeout: 5_000 });
});
