import { expect, test } from '@playwright/test';

test('opens the workbench after signing in with a synthetic Frappe session', async ({
  page,
}) => {
  test.setTimeout(90_000);
  let signedIn = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/login') && route.request().method() === 'POST') {
      signedIn = true;
      return route.fulfill({ json: { message: 'Logged In' } });
    }
    if (signedIn && path.endsWith('.get_session')) {
      return route.fulfill({
        json: {
          message: {
            userid: 'operator@example.test',
            name: 'Example Operator',
            roles: [],
            site: 'rehab.example.test',
            capabilities: { can_admin: false },
            csrf_token: 'example-test-token',
          },
        },
      });
    }
    if (signedIn && path.endsWith('.get_apps')) {
      return route.fulfill({
        json: { message: [{ name: 'rehab', title: '康复管理演示' }] },
      });
    }
    return route.fulfill({ status: 401, json: { message: 'Sign in first' } });
  });

  await page.goto('/console/user/login');
  await expect(page.getByText('账号登录', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByPlaceholder('请输入医院账号').fill('operator@example.test');
  await page.getByPlaceholder('请输入密码').fill('synthetic-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();

  await expect(page).toHaveURL(/\/console\/apps$/);
  await expect(page.getByText('康复管理演示')).toBeVisible();
});
