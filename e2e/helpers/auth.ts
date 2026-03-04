import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_FILE = path.join(__dirname, '..', '.auth-state.json');

/**
 * 测试辅助函数：用户认证
 * 使用 storageState 缓存登录态，避免每个测试都重新登录触发限流
 *
 * 优化策略：复用缓存时跳过额外导航，只预设 cookies + localStorage，
 * 让测试自己的 goto 完成页面加载，减少 API 请求防止触发限流
 */

export async function loginAsAdmin(page: Page) {
  // 检查是否已登录
  const currentURL = page.url();
  if (currentURL.includes('/console')) {
    return;
  }

  // 尝试复用已保存的登录态（cookies + localStorage）
  if (fs.existsSync(AUTH_STATE_FILE)) {
    try {
      const stateJson = fs.readFileSync(AUTH_STATE_FILE, 'utf-8');
      const state = JSON.parse(stateJson);

      // 恢复 cookies（服务端 session）
      await page.context().addCookies(state.cookies || []);

      // 通过 addInitScript 在页面加载前注入 localStorage（前端路由守卫依赖）
      // addInitScript 会在每次页面导航时自动执行，无需额外导航
      for (const origin of state.origins || []) {
        for (const item of origin.localStorage || []) {
          await page.addInitScript(
            ({ key, value }) => {
              try { localStorage.setItem(key, value); } catch {}
            },
            { key: item.name, value: item.value }
          );
        }
      }

      // 不做额外导航，让测试自己的 page.goto() 直接加载目标页面
      // 这样每个测试只产生 1 次页面加载而不是 3 次，大幅减少 API 请求
      return;
    } catch {
      // 登录态无效，继续走正常登录流程
    }
  }

  // 正常登录流程
  await page.goto('/login', { waitUntil: 'networkidle' });

  const usernameInput = page.getByPlaceholder(/Please enter your username or email address|请输入您的用户名或邮箱地址/i);
  const passwordInput = page.getByPlaceholder(/Please enter your password|请输入您的密码/i);
  const continueButton = page.getByRole('button', { name: /Continue|继续/i });

  await usernameInput.fill('admin');
  await passwordInput.fill('admin123456');
  await continueButton.click();

  // 等待登录成功跳转
  await page.waitForURL(/\/console/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');

  // 保存登录态供后续测试复用
  const state = await page.context().storageState();
  fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state));
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /admin/i }).click();
  await page.getByText('退出登录').click();
  await page.waitForURL('/login');

  // 清除保存的登录态
  if (fs.existsSync(AUTH_STATE_FILE)) {
    fs.unlinkSync(AUTH_STATE_FILE);
  }
}
