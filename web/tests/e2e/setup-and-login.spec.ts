import { expect, test } from '@playwright/test';
import { withDockerHubStub } from '../helpers/dockerHubStub';

const adminUsername = 'e2eroot';
const adminPassword = 'e2e-password';
const dockerHubStubPort = 3403;
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

async function loginAsRoot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await openPasswordLogin(page);
  await page.getByPlaceholder(loginUsernamePlaceholder).fill(adminUsername);
  await page.getByPlaceholder(loginPasswordPlaceholder).fill(adminPassword);
  await page.getByRole('button', { name: continueButtonName }).click();
  await expect(page).toHaveURL(/\/console/);
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

  test('system settings show docker image version and update info', async ({ page }) => {
    await withDockerHubStub(
      dockerHubStubPort,
      {
        results: [
          { name: 'latest', last_updated: '2026-03-21T10:00:00Z' },
          { name: 'v0.11.6', last_updated: '2026-03-21T10:00:00Z' },
          { name: 'v0.11.5', last_updated: '2026-03-20T10:00:00Z' },
        ],
      },
      async () => {
        await loginAsRoot(page);

        await page.goto('/console/setting?tab=other');
        await expect(page.getByText(/v0.11.5/)).toBeVisible();
        await page.getByRole('button', { name: /检查更新|Check for updates/ }).click();
        await expect(
          page.getByRole('heading', { name: /v0.11.6/ }),
        ).toBeVisible();
        await expect(page.getByText('playwright/new-api')).toBeVisible();
      },
    );
  });

  test('contact page submissions appear in feedback management and logo can be uploaded', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /采购咨询|Consulting/ }).click();
    await page.getByPlaceholder(/请输入你的称呼|name/i).fill('E2E Contact User');
    await page
      .getByPlaceholder(/请输入可联系的邮箱|email/i)
      .fill('e2e-feedback@example.com');
    await page
      .getByPlaceholder(/适用于套餐、计费、部署、私有化或商务合作咨询|deployment|billing/i)
      .fill('Submitting a bug report from the e2e contact page should make it visible to administrators.');
    await page.getByRole('button', { name: /提交反馈|Submit feedback/ }).click();
    await expect(page.getByText(/反馈已提交|submitted/i)).toBeVisible();

    await loginAsRoot(page);

    await page.goto('/console/feedback');
    await expect(page.getByText('E2E Contact User')).toBeVisible();
    await expect(page.getByText('e2e-feedback@example.com')).toBeVisible();

    await page.goto('/console/setting?tab=other');
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake-png-content'),
      });
    await expect(page.getByText(/已选择文件|Selected file/)).toContainText('logo.png');
    await page.getByRole('button', { name: /上传并设置 Logo|Upload and set Logo/ }).click();
    await expect(page.getByText(/\/uploads\/branding\/logo-/)).toBeVisible();
    await page.getByText(/启用反馈 Lark Webhook|Enable feedback Lark Webhook/).click();
    await page
      .getByPlaceholder(/open-apis\/bot\/v2\/hook/i)
      .fill('https://open.larksuite.com/open-apis/bot/v2/hook/example');
    await page
      .getByPlaceholder(/从 Lark 自定义机器人获取，可留空|can be empty/i)
      .fill('temporary-secret');
    await page
      .getByPlaceholder(/填写一个或多个 Open ID|Open ID/i)
      .fill('ou_alpha\nou_beta');
    await page.getByRole('button', { name: /保存反馈 Lark Webhook|Save feedback Lark Webhook/ }).click();
    await expect(page.getByText(/反馈 Lark Webhook 已更新|updated/i)).toBeVisible();
  });

  test('contact page prefills the username for logged-in users', async ({ page }) => {
    await loginAsRoot(page);

    await page.goto('/contact');
    await expect(page.getByPlaceholder(/请输入你的称呼|name/i)).toHaveValue(adminUsername);
  });
});
