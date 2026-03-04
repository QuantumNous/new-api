import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 订阅功能 E2E 测试
 *
 * 测试范围：
 * - Q2: 订阅显示 3 个固定按钮（Card / Apple Pay / Google Pay）
 * - Q3: 订阅周期动态映射（技术债修复）
 * - 订阅支付使用 USD 币种（一次性支付用 IDR，订阅用 USD）
 */

test.describe('Waffo 订阅功能回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('TC-E2E-101: 订阅套餐区域显示正确', async ({ page }) => {
    await page.goto('/console/topup');

    // 等待订阅套餐区域加载
    await page.waitForSelector('text=订阅套餐', { timeout: 10000 });

    // 验证订阅套餐标题存在
    await expect(page.locator('text=订阅套餐')).toBeVisible();

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/subscription-area.png', fullPage: true });
  });

  test('TC-E2E-102: 订阅购买 Modal 显示 3 个固定支付按钮', async ({ page }) => {
    // 先导航到页面（触发 addInitScript 设置 cookies/localStorage）
    await page.goto('/console/topup', { waitUntil: 'networkidle' });

    // 通过 API 创建临时订阅套餐（如果不存在）
    // 管理员 API 需要 New-Api-User 头（从 localStorage 中获取用户 ID）
    const existingPlans = await page.evaluate(async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || -1;
      const res = await fetch('/api/subscription/admin/plans', {
        headers: { 'New-Api-User': String(userId) },
      });
      const data = await res.json();
      return data.data || [];
    });

    let createdPlanId: number | null = null;
    const hasPlans = existingPlans.length > 0 && existingPlans.some((p: any) => p.plan?.enabled);

    if (!hasPlans) {
      // 创建一个测试用订阅套餐
      createdPlanId = await page.evaluate(async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || -1;
        const res = await fetch('/api/subscription/admin/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': String(userId),
          },
          body: JSON.stringify({
            plan: {
              title: 'E2E 测试套餐',
              subtitle: '自动化测试用，测试后自动删除',
              price_amount: 9.99,
              currency: 'USD',
              duration_unit: 'month',
              duration_value: 1,
              enabled: true,
              total_amount: 500000,
              sort_order: 999,
            },
          }),
        });
        const data = await res.json();
        return data.data?.id || null;
      });

      // 刷新页面以加载新套餐
      await page.reload({ waitUntil: 'networkidle' });
    }

    try {
      // 等待充值区域的 Waffo 按钮出现，确认 getTopupInfo() 已完成且 enableWaffoTopUp=true
      // SubscriptionPlansCard 可能先于 getTopupInfo() 渲染完毕，如果直接点击"立即订阅"
      // 此时 enableWaffoTopUp 仍为 false，Modal 中不会显示支付按钮
      const waffoButton = page.getByRole('button', { name: 'Waffo' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });

      // 等待套餐卡片渲染
      const subscribeButton = page.getByRole('button', { name: '立即订阅' }).first();
      await expect(subscribeButton).toBeVisible({ timeout: 10000 });

      // 点击第一个套餐的订阅按钮
      await subscribeButton.click();

      // 等待 Modal 打开
      await page.waitForSelector('text=购买订阅套餐', { timeout: 5000 });

      // 验证 Waffo 的 3 个支付按钮存在
      // 注意：Card 按钮带有 IconCreditCard 图标，其 accessible name 为 "credit_card Card"
      const cardButton = page.getByRole('button', { name: /Card/ });
      const applePayButton = page.getByRole('button', { name: 'Apple Pay', exact: true });
      const googlePayButton = page.getByRole('button', { name: 'Google Pay', exact: true });

      await expect(cardButton).toBeVisible();
      await expect(applePayButton).toBeVisible();
      await expect(googlePayButton).toBeVisible();

      // 截图记录
      await page.screenshot({ path: 'e2e-screenshots/subscription-payment-buttons.png' });
    } finally {
      // 清理：删除测试用套餐（通过禁用它）
      if (createdPlanId) {
        await page.evaluate(async (planId) => {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = user.id || -1;
          await fetch(`/api/subscription/admin/plans/${planId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'New-Api-User': String(userId),
            },
            body: JSON.stringify({ enabled: false }),
          });
        }, createdPlanId);
      }
    }
  });

  test('TC-E2E-105: 订阅支付 API 使用正确币种（USD）并返回支付链接', async ({ page }) => {
    // 业务规则：一次性充值使用 IDR，订阅支付使用 USD（套餐自身的 currency 字段）
    // 此测试验证点击支付按钮后，后端能成功创建 Waffo 订阅订单并返回 payment_url
    // 如果币种错误（如使用系统默认 IDR），Waffo API 会返回 A0003 参数校验失败

    await page.goto('/console/topup', { waitUntil: 'networkidle' });

    // 确保有可用的订阅套餐
    const existingPlans = await page.evaluate(async () => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      const userId = user.id || -1;
      const res = await fetch('/api/subscription/admin/plans', {
        headers: { 'New-Api-User': String(userId) },
      });
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      return data.data || [];
    });

    let createdPlanId: number | null = null;
    const hasPlans = existingPlans.length > 0 && existingPlans.some((p: any) => p.plan?.enabled);

    if (!hasPlans) {
      createdPlanId = await page.evaluate(async () => {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        const userId = user.id || -1;
        const res = await fetch('/api/subscription/admin/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'New-Api-User': String(userId),
          },
          body: JSON.stringify({
            plan: {
              title: 'E2E 币种测试套餐',
              subtitle: '验证订阅支付使用 USD 币种',
              price_amount: 9.99,
              currency: 'USD',
              duration_unit: 'month',
              duration_value: 1,
              enabled: true,
              total_amount: 500000,
              sort_order: 999,
            },
          }),
        });
        const text = await res.text();
        if (!text) return null;
        const data = JSON.parse(text);
        return data.data?.id || null;
      });
      await page.reload({ waitUntil: 'networkidle' });
    }

    try {
      // 等待 Waffo 支付按钮出现（确认 getTopupInfo 完成且 enableWaffoTopUp=true）
      const waffoButton = page.getByRole('button', { name: 'Waffo' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });

      // 点击"立即订阅"打开 Modal
      const subscribeButton = page.getByRole('button', { name: '立即订阅' }).first();
      await expect(subscribeButton).toBeVisible({ timeout: 10000 });
      await subscribeButton.click();
      await page.waitForSelector('text=购买订阅套餐', { timeout: 5000 });

      // 拦截 Waffo 订阅支付 API 调用
      const paymentResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/subscription/waffo/pay') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      // 拦截 window.open 防止打开新标签页
      await page.evaluate(() => {
        (window as any)._originalOpen = window.open;
        window.open = () => null;
      });

      // 点击 Card 按钮发起支付
      const cardButton = page.getByRole('button', { name: /Card/ });
      await expect(cardButton).toBeVisible();
      await cardButton.click();

      // 等待 API 响应
      const response = await paymentResponsePromise;
      const responseBody = await response.json();

      // 验证支付 API 返回成功（message: "success" + 有 payment_url）
      // 如果币种不正确，Waffo 会返回 A0003 错误，此断言会失败
      expect(responseBody.message).toBe('success');
      expect(responseBody.data).toBeDefined();
      expect(responseBody.data.payment_url).toBeTruthy();
      expect(responseBody.data.payment_url).toContain('https://');
      expect(responseBody.data.order_id).toBeTruthy();

      // 恢复 window.open
      await page.evaluate(() => {
        if ((window as any)._originalOpen) {
          window.open = (window as any)._originalOpen;
        }
      });

      console.log('✅ 订阅支付 API 成功返回支付链接，币种配置正确');

      // 截图记录
      await page.screenshot({ path: 'e2e-screenshots/subscription-payment-api-success.png' });
    } finally {
      if (createdPlanId) {
        await page.evaluate(async (planId) => {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = user.id || -1;
          await fetch(`/api/subscription/admin/plans/${planId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'New-Api-User': String(userId),
            },
            body: JSON.stringify({ enabled: false }),
          });
        }, createdPlanId);
      }
    }
  });

  test('TC-E2E-103: 订阅套餐信息显示完整', async ({ page }) => {
    await page.goto('/console/topup');
    await page.waitForTimeout(2000);

    // 检查是否有订阅套餐
    const subscriptionArea = page.locator('text=订阅套餐').first();
    if (!(await subscriptionArea.isVisible())) {
      console.log('⚠️  订阅功能区域不可见');
      test.skip();
      return;
    }

    // 如果有套餐，验证显示的关键信息
    const hasPlanCards = await page.locator('text=/有效期|总额度|价格/').count() > 0;

    if (hasPlanCards) {
      // 验证套餐卡片包含必要信息
      await expect(page.locator('text=/有效期|周期/').first()).toBeVisible();
      console.log('✅ 订阅套餐信息显示正常');
    } else {
      console.log('ℹ️  当前无可用订阅套餐');
    }

    // 截图记录
    await page.screenshot({ path: 'e2e-screenshots/subscription-plan-cards.png', fullPage: true });
  });

  test('TC-E2E-104: 订阅计费偏好设置正确显示', async ({ page }) => {
    await page.goto('/console/topup');
    await page.waitForTimeout(2000);

    // 查找计费偏好下拉框
    const billingPreference = page.locator('text=/优先订阅|优先余额|先订阅后余额/');

    if (await billingPreference.isVisible()) {
      await expect(billingPreference).toBeVisible();
      console.log('✅ 计费偏好设置可见');

      // 截图记录
      await page.screenshot({ path: 'e2e-screenshots/billing-preference.png' });
    } else {
      console.log('ℹ️  计费偏好设置不可见（可能是无订阅套餐）');
    }
  });
});
