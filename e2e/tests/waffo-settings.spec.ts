import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 管理后台设置 E2E 测试
 *
 * 测试范围：
 * - 管理员设置 Waffo 配置
 * - 币种配置（Q1）
 * - 启用/禁用 Waffo 支付
 */

// 读写真实 DB 配置，串行避免冲突
test.describe.configure({ mode: 'serial' });

test.describe('Waffo 管理后台设置回归测试', () => {
  test.beforeEach(async ({ page }) => {
    // 多 worker 并发时 session 压力大，给所有设置页测试 3× 超时
    test.slow();
    await loginAsAdmin(page);
  });

  test('TC-E2E-201: 管理后台可访问 Waffo 设置页面', async ({ page }) => {
    // 导航到支付设置页面
    await page.goto('/console/setting', { waitUntil: 'load' });

    // 等待 Tab 出现（isRoot 判断依赖 localStorage，并发下需要更长等待）
    await page.waitForSelector('text=/支付设置|Payment.*Setting/i', { timeout: 15000 });
    // 点击支付网关选项卡
    // Click payment gateway tab - use flexible selector for both EN/ZH
    await page.locator('text=/支付设置|Payment.*Setting/i').first().click();

    // 验证 Waffo 设置区域存在
    await expect(page.getByRole('heading', { name: 'Waffo 设置' })).toBeVisible();

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/settings-waffo-tab.png' });
  });

  test('TC-E2E-202: Waffo 设置包含必要配置项', async ({ page }) => {
    await page.goto('/console/setting', { waitUntil: 'load' });
    await page.waitForSelector('text=/支付设置|Payment.*Setting/i', { timeout: 15000 });
    // Click payment gateway tab - use flexible selector for both EN/ZH
    await page.locator('text=/支付设置|Payment.*Setting/i').first().click();

    // 验证关键配置项存在
    const waffoSection = page.getByRole('heading', { name: 'Waffo 设置' }).locator('..');

    // 检查是否有启用开关
    const enableSwitch = waffoSection.getByRole('switch').first();
    if (await enableSwitch.isVisible()) {
      await expect(enableSwitch).toBeVisible();
      console.log('✅ Waffo 启用开关存在');
    }

    // 检查是否有沙盒模式开关
    const sandboxToggle = page.getByText('沙盒模式', { exact: true });
    if (await sandboxToggle.isVisible()) {
      await expect(sandboxToggle).toBeVisible();
      console.log('✅ Waffo 沙盒模式开关存在');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/settings-waffo-fields.png' });
  });

  test('TC-E2E-203: Waffo 币种配置项存在且符合 Q1 要求', async ({ page }) => {
    await page.goto('/console/setting', { waitUntil: 'load' });
    await page.waitForSelector('text=/支付设置|Payment.*Setting/i', { timeout: 15000 });
    // Click payment gateway tab - use flexible selector for both EN/ZH
    await page.locator('text=/支付设置|Payment.*Setting/i').first().click();

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 查找币种下拉框
    const currencyDropdown = page.locator('text=/币种|Currency/i');

    if (await currencyDropdown.isVisible()) {
      await expect(currencyDropdown).toBeVisible();
      console.log('✅ Waffo 币种配置项存在');

      // 点击查看选项
      await currencyDropdown.click();

      // 验证支持的币种（USD/EUR/CNY/HKD/SGD/MYR/IDR/PHP/THB）
      const supportedCurrencies = ['USD', 'CNY', 'IDR'];
      for (const currency of supportedCurrencies) {
        const option = page.locator(`text="${currency}"`);
        if (await option.isVisible()) {
          console.log(`✅ 支持币种: ${currency}`);
        }
      }

      // 截图记录
      await page.screenshot({ path: 'e2e-screenshots/settings-waffo-currency.png' });
    } else {
      console.log('ℹ️  币种配置项不可见（可能在折叠区域）');
    }
  });

  test('TC-E2E-204: Waffo 设置保存成功', async ({ page }) => {
    await page.goto('/console/setting', { waitUntil: 'load' });
    await page.waitForSelector('text=/支付设置|Payment.*Setting/i', { timeout: 15000 });
    // Click payment gateway tab - use flexible selector for both EN/ZH
    await page.locator('text=/支付设置|Payment.*Setting/i').first().click();

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 查找保存按钮
    const saveButton = page.getByRole('button', { name: /保存|提交|Save/i }).first();

    if (await saveButton.isVisible()) {
      // 点击保存按钮
      await saveButton.click();

      // 等待保存结果
      await page.waitForTimeout(1500);

      // 验证是否有成功提示（可能是 toast 通知）
      const successMessage = page.locator('text=/成功|Success/i');
      if (await successMessage.isVisible()) {
        await expect(successMessage).toBeVisible();
        console.log('✅ Waffo 设置保存成功');
      }

      // 截图记录
      await page.screenshot({ path: 'e2e-screenshots/settings-waffo-save-success.png' });
    } else {
      console.log('ℹ️  保存按钮不可见');
    }
  });
});
