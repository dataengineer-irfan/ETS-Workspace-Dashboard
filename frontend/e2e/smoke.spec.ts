import { expect, test } from '@playwright/test';

test('unauthenticated visit loads the login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ETS Workforce/);
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByText('ETS Workforce Intelligence Platform')).toBeVisible();
});
