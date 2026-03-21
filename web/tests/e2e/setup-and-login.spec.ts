import { expect, test } from '@playwright/test';

const adminUsername = 'e2eroot';
const adminPassword = 'e2e-password';
const nextButtonName = /^(Next|下一步)$/;
const initHeading = /(System initialization|系统初始化)/;
const initSummary = /(Ready to complete initialization|准备完成初始化)/;
const initSubmitButtonName = /(Initialize system|初始化系统)/;
const continueButtonName = /^(Continue|继续)$/;
const emailLoginButtonName = /(Continue with Email or Username|使用 邮箱或用户名 登录)/;
const adminUsernamePlaceholder = /(Please enter the admin username|请输入管理员用户名)/;
const adminPasswordPlaceholder = /(Please enter the admin password|请输入管理员密码)/;
const adminConfirmPasswordPlaceholder = /(Please confirm the admin password|请确认管理员密码)/;
const loginUsernamePlaceholder = /(Please enter your username or email address|请输入您的用户名或邮箱地址)/;
const loginPasswordPlaceholder = /(Please enter your password|请输入您的密码)/;

async function openPasswordLogin(page: import('@playwright/test').Page): Promise<void> {
  const emailLoginButton = page.getByRole('button', {
    name: emailLoginButtonName,
  });
  if (await emailLoginButton.isVisible().catch(() => false)) {
    await emailLoginButton.click();
  }
}

test.describe.serial('Setup and login baseline', () => {
  test('anonymous home navigation redirects to setup when the system is uninitialized', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole('button', { name: nextButtonName })).toBeVisible();
    await expect(page.getByText(initHeading)).toBeVisible();
  });

  test('setup wizard can initialize the system and root user can sign in', async ({ page }) => {
    await page.goto('/setup');

    await page.getByRole('button', { name: nextButtonName }).click();
    await page.getByPlaceholder(adminUsernamePlaceholder).fill(adminUsername);
    await page.getByPlaceholder(adminPasswordPlaceholder).fill(adminPassword);
    await page
      .getByPlaceholder(adminConfirmPasswordPlaceholder)
      .fill(adminPassword);
    await page.getByRole('button', { name: nextButtonName }).click();
    await page.getByRole('button', { name: nextButtonName }).click();
    await expect(page.getByText(initSummary)).toBeVisible();

    await page.getByRole('button', { name: initSubmitButtonName }).click();
    await expect(page).not.toHaveURL(/\/setup$/);

    await page.goto('/login');
    await openPasswordLogin(page);
    await page.getByPlaceholder(loginUsernamePlaceholder).fill(adminUsername);
    await page.getByPlaceholder(loginPasswordPlaceholder).fill(adminPassword);
    await page.getByRole('button', { name: continueButtonName }).click();

    await expect(page).toHaveURL(/\/console/);
  });
});
