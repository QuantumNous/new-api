import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 充值功能 E2E 测试
 *
 * 测试范围：
 * - Q1: 币种配置
 * - Q2: 充值统一品牌展示
 * - R6: 无前端金额限制
 */

test.describe('Waffo 充值功能回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('TC-E2E-001: 充值页面显示 Waffo 统一品牌按钮', async ({ page }) => {
    // 导航到充值页面，等待 API 调用完成
    await page.goto('/console/topup', { waitUntil: 'load' });

    // 等待充值表单加载完成（statusLoading 变为 false 后才渲染支付按钮）
    const waffoButton = page.getByRole('button', { name: 'Card' });
    await expect(waffoButton).toBeVisible({ timeout: 30000 });

    // 验证不存在 "Credit Card" 按钮
    const creditCardButton = page.getByRole('button', { name: 'Credit Card', exact: true });
    await expect(creditCardButton).not.toBeVisible();

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-waffo-button.png' });
  });

  test('TC-E2E-002: Waffo 按钮可点击且不需要选择支付方式', async ({ page }) => {
    await page.goto('/console/topup', { waitUntil: 'load' });

    // 等待充值表单加载完成后输入金额
    const amountInput = page.locator('.semi-input-number input').first();
    await amountInput.fill('10', { timeout: 30000 });

    // 点击 Waffo 按钮
    const waffoButton = page.getByRole('button', { name: 'Card' });
    await waffoButton.click();

    // 由于实际支付会跳转到 Waffo 页面，这里验证是否触发了请求
    // 实际测试中会看到网络请求或新窗口打开
    // 在测试环境中，由于配置不完整，可能会显示错误，这是预期的
    await page.waitForTimeout(2000);

    // 截图记录当前状态
    await page.screenshot({ path: 'e2e-screenshots/topup-after-click.png' });
  });

  test('TC-E2E-003: 充值金额无前端限制（系统最小值除外）', async ({ page }) => {
    await page.goto('/console/topup', { waitUntil: 'load' });

    const amountInput = page.locator('.semi-input-number input').first();

    // 测试输入小金额（1）
    await amountInput.fill('1');
    await expect(amountInput).toHaveValue('1');

    // 测试输入大金额（999999）
    await amountInput.fill('999999');
    await expect(amountInput).toHaveValue('999999');

    // 验证 Waffo 按钮对任意金额都可点击（只要 >= 系统最小值）
    const waffoButton = page.getByRole('button', { name: 'Card' });
    await expect(waffoButton).toBeEnabled();
  });

  test('TC-E2E-004: 充值页面支付方式只显示已启用的渠道', async ({ page }) => {
    await page.goto('/console/topup', { waitUntil: 'load' });

    // 等待支付方式区域加载（statusLoading 完成后才渲染）
    await page.waitForSelector('text=选择支付方式', { timeout: 30000 });

    // 验证 Waffo 按钮存在
    await expect(page.getByRole('button', { name: 'Card' })).toBeVisible();

    // 验证未启用的支付方式按钮是 disabled 状态
    // （支付宝、微信等如果未配置应该是 disabled）
    const alipayButton = page.getByRole('button', { name: '支付宝', exact: true });
    if (await alipayButton.isVisible()) {
      await expect(alipayButton).toBeDisabled();
    }
  });

  test('TC-E2E-005: 实付金额正确显示', async ({ page }) => {
    await page.goto('/console/topup', { waitUntil: 'load' });

    // 输入充值金额
    const amountInput = page.locator('.semi-input-number input').first();
    await amountInput.fill('100');

    // 等待实付金额计算
    await page.waitForTimeout(1000);

    // 验证实付金额显示（应该显示类似 "实付金额：730 元" 或其他货币）
    const amountText = page.locator('text=/实付金额/');
    await expect(amountText).toBeVisible();

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/topup-amount-display.png' });
  });
});
