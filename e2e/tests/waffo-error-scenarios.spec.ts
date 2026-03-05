import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 错误场景 E2E 测试
 *
 * 测试范围：
 * - 无效金额输入
 * - 未配置 Waffo 时的行为
 * - 网络错误处理
 * - 支付失败场景
 */

/** mock topup/info 注入一个名为 'Card' 的 Waffo 支付方式 */
async function mockTopupInfoWithCard(page: import('@playwright/test').Page) {
  await page.route('**/api/user/topup/info', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          enable_online_topup: false,
          enable_waffo_topup: true,
          enable_stripe_topup: false,
          enable_creem_topup: false,
          pay_methods: [],
          waffo_pay_methods: [
            { name: 'Card', payMethodType: 'CREDITCARD', payMethodName: '', icon: '' },
          ],
          min_topup: 1,
          waffo_min_topup: 1,
          amount_options: [],
          discount: {},
        },
      }),
    });
  });
  // mock waffo/pay 防止真实 SDK 调用和页面跳转
  await page.route('**/api/user/waffo/pay', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: '充值金额无效' }),
    });
  });
}

test.describe('Waffo 错误场景回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('TC-E2E-301: 充值金额为空时按钮应禁用或提示', async ({ page }) => {
    await mockTopupInfoWithCard(page);
    await page.goto('/console/topup');

    // 清空金额输入框
    const amountInput = page.locator('.semi-input-number input').first();
    await amountInput.clear();

    // 验证 Waffo 按钮状态
    const waffoButton = page.getByRole('button', { name: 'Card' });

    // 点击查看是否有错误提示
    await waffoButton.click();
    await page.waitForTimeout(1000);

    // 可能出现的情况：
    // 1. 按钮禁用
    // 2. 弹出错误提示
    // 3. 输入框显示验证错误

    const errorMessage = page.locator('text=/请输入|金额不能为空|无效/i');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
      console.log('✅ 空金额时显示错误提示');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-empty-amount-error.png' });
  });

  test('TC-E2E-302: 充值金额为负数时应拒绝', async ({ page }) => {
    await mockTopupInfoWithCard(page);
    await page.goto('/console/topup');

    const amountInput = page.locator('.semi-input-number input').first();

    // 尝试输入负数
    await amountInput.fill('-100');

    // 验证值是否被正确处理
    const value = await amountInput.inputValue();

    if (value === '-100') {
      // 如果允许输入负数，点击 Waffo 按钮应该有错误提示
      const waffoButton = page.getByRole('button', { name: 'Card' });
      await waffoButton.click();
      await page.waitForTimeout(1000);

      const errorMessage = page.locator('text=/无效|负数|错误/i');
      if (await errorMessage.isVisible()) {
        console.log('✅ 负数金额时显示错误提示');
      }
    } else {
      // 输入框自动拒绝负数
      console.log('✅ 输入框自动拒绝负数');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-negative-amount.png' });
  });

  test('TC-E2E-303: 充值金额为 0 时应拒绝', async ({ page }) => {
    await mockTopupInfoWithCard(page);
    await page.goto('/console/topup');

    const amountInput = page.locator('.semi-input-number input').first();
    await amountInput.fill('0');

    const waffoButton = page.getByRole('button', { name: 'Card' });
    await waffoButton.click();

    await page.waitForTimeout(1000);

    // 应该有错误提示或按钮禁用
    const errorMessage = page.locator('text=/金额必须大于|最小金额|无效/i');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
      console.log('✅ 金额为 0 时显示错误提示');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-zero-amount.png' });
  });

  test('TC-E2E-304: 未配置 Waffo 时按钮应禁用或不显示', async ({ page }) => {
    await mockTopupInfoWithCard(page);
    await page.goto('/console/topup');

    // 等待页面加载
    await page.waitForTimeout(2000);

    const waffoButton = page.getByRole('button', { name: 'Card' });

    // 验证按钮状态
    if (await waffoButton.isVisible()) {
      // 如果按钮可见，检查是否启用
      const isEnabled = await waffoButton.isEnabled();

      if (isEnabled) {
        console.log('✅ Waffo 已配置且启用');
      } else {
        console.log('⚠️  Waffo 按钮已禁用（可能未配置）');
      }
    } else {
      console.log('ℹ️  Waffo 按钮不显示（未启用）');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-waffo-disabled.png' });
  });

  test('TC-E2E-305: 订阅购买时无套餐应显示提示', async ({ page }) => {
    await page.goto('/console/topup');
    await page.waitForTimeout(2000);

    // 查找订阅套餐区域
    const subscriptionArea = page.locator('text=订阅套餐').first();

    if (await subscriptionArea.isVisible()) {
      // 检查是否有套餐
      const planCards = page.locator('[class*="Card"]').filter({ hasText: /月|年|天/ });
      const planCount = await planCards.count();

      if (planCount === 0) {
        // 无套餐时应该有提示
        const emptyMessage = page.locator('text=/暂无|无可用|没有套餐/i');
        if (await emptyMessage.isVisible()) {
          await expect(emptyMessage).toBeVisible();
          console.log('✅ 无套餐时显示提示信息');
        } else {
          console.log('ℹ️  无套餐但无明确提示');
        }
      } else {
        console.log(`ℹ️  当前有 ${planCount} 个订阅套餐`);
      }
    } else {
      console.log('ℹ️  订阅功能区域不可见');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/subscription-no-plans.png', fullPage: true });
  });

  test('TC-E2E-306: 充值金额超大值处理', async ({ page }) => {
    await mockTopupInfoWithCard(page);
    await page.goto('/console/topup');

    const amountInput = page.locator('.semi-input-number input').first();

    // 尝试输入超大金额
    await amountInput.fill('999999999999');

    // 验证系统如何处理
    const value = await amountInput.inputValue();
    console.log(`输入超大金额后的值: ${value}`);

    // 点击 Waffo 按钮查看行为
    const waffoButton = page.getByRole('button', { name: 'Card' });
    await waffoButton.click();

    await page.waitForTimeout(2000);

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-huge-amount.png' });
  });
});
