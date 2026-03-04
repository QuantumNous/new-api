import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';
import {
  completePaymentFlow,
  parseRedirectUrl,
  TEST_CARD,
  TEST_3DS_CARD,
} from '../helpers/waffo-checkout';
import { waitForSubscriptionOrderSuccess } from '../helpers/order-verify';

/**
 * Waffo 订阅支付全流程 E2E 测试
 *
 * 验证完整的订阅支付生命周期：
 *   1. 登录前端 -> 导航到充值页 -> 点击订阅 -> 在 Modal 中点击 Card -> 捕获 payment_url + order_id
 *   2. 导航到 Waffo checkout 页面 -> 填写卡信息 -> 提交 -> 处理 3DS -> 等待结果
 *   3. 轮询后端 admin API 验证订单状态变为 success（订阅订单同时创建 topup 记录，trade_no 相同）
 *
 * 隧道和回调 URL 由 global-setup.ts / global-teardown.ts 统一管理，
 * 所有 *-flow.spec.ts 共享同一个 cloudflared 隧道。
 *
 * 前置条件：
 *   - 后端运行在 localhost:3000
 *   - 前端开发服务器运行在 localhost:5173
 *   - Waffo sandbox 配置已启用（WaffoEnabled=true, WaffoSandbox=true）
 *   - cloudflared 已安装在 /opt/homebrew/bin/cloudflared
 */

const BACKEND_BASE_URL = 'http://localhost:3000';

test.describe('Waffo 订阅支付全流程 E2E', () => {

  test('TC-FLOW-101: 订阅支付完整流程 - Card 支付（无3DS）', async ({ page }) => {
    test.slow();
    console.log('[E2E] ========== TC-FLOW-101: Card 支付（无3DS） ==========');

    let createdPlanId: number | null = null;

    try {
      // Step 1: Login
      console.log('[E2E] Step 1: Logging in as admin...');
      await loginAsAdmin(page);
      console.log('[E2E] Login successful');

      // Step 2: Navigate to topup page
      console.log('[E2E] Step 2: Navigating to /console/topup...');
      await page.goto('/console/topup', { waitUntil: 'networkidle' });
      console.log(`[E2E] Current URL: ${page.url()}`);

      // Step 3: Ensure subscription plan exists
      console.log('[E2E] Step 3: Checking for existing subscription plans...');
      const existingPlans = await page.evaluate(async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || -1;
        const res = await fetch('/api/subscription/admin/plans', {
          headers: { 'New-Api-User': String(userId) },
        });
        const data = await res.json();
        return data.data || [];
      });
      console.log(`[E2E] Found ${existingPlans.length} existing plans`);

      const hasPlans =
        existingPlans.length > 0 &&
        existingPlans.some((p: any) => p.plan?.enabled);
      console.log(`[E2E] Has enabled plans: ${hasPlans}`);

      if (!hasPlans) {
        console.log('[E2E] No enabled plans found, creating test plan...');
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
                title: 'E2E Payment Flow Test Plan',
                subtitle: 'Auto-created for E2E payment flow testing',
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
        console.log(`[E2E] Created test plan with ID: ${createdPlanId}`);
        await page.reload({ waitUntil: 'networkidle' });
        console.log('[E2E] Page reloaded after plan creation');
      }

      // Step 4: Wait for Card button to confirm getTopupInfo loaded (waffoPayMethods configured)
      console.log('[E2E] Step 4: Waiting for Card button (confirms enableWaffoTopUp=true)...');
      const waffoButton = page.getByRole('button', { name: 'Card' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });
      console.log('[E2E] Waffo button is visible');

      // Step 5: Click first subscribe button to open modal
      console.log('[E2E] Step 5: Clicking subscribe button...');
      const subscribeButton = page
        .getByRole('button', { name: '立即订阅' })
        .first();
      await expect(subscribeButton).toBeVisible({ timeout: 10000 });
      await subscribeButton.click();
      console.log('[E2E] Subscribe button clicked');

      // Step 6: Wait for modal
      console.log('[E2E] Step 6: Waiting for subscription modal...');
      await page.waitForSelector('text=购买订阅套餐', { timeout: 5000 });
      console.log('[E2E] Modal opened successfully');

      // Step 7: Set up API response interception
      console.log('[E2E] Step 7: Setting up API response interception...');
      const paymentResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/subscription/waffo/pay') &&
          resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      // Step 8: Intercept window.open to capture payment URL
      console.log('[E2E] Step 8: Intercepting window.open...');
      await page.evaluate(() => {
        (window as any)._waffoPaymentUrl = '';
        (window as any)._originalOpen = window.open;
        window.open = (url?: string | URL) => {
          (window as any)._waffoPaymentUrl = url ? String(url) : '';
          console.log('[E2E-browser] window.open intercepted:', url);
          return null;
        };
      });

      // Step 9: Click Waffo payment button (label is '确认支付' when Waffo is the only method, 'Waffo' otherwise)
      console.log('[E2E] Step 9: Clicking Waffo payment button...');
      const cardButton = page.getByRole('button', { name: /确认支付|Waffo/ });
      await expect(cardButton).toBeVisible({ timeout: 5000 });
      await cardButton.click();
      console.log('[E2E] Waffo payment button clicked');

      // Step 10: Wait for API response and extract data
      console.log('[E2E] Step 10: Waiting for API response...');
      const response = await paymentResponsePromise;
      console.log(`[E2E] API response status: ${response.status()}`);

      // Handle rate-limited responses (429 returns empty body)
      expect(response.status()).not.toBe(429);
      const responseText = await response.text();
      console.log(`[E2E] API response body: ${responseText}`);
      const responseBody = JSON.parse(responseText);

      let paymentUrl = responseBody.data?.payment_url || '';
      const orderId = responseBody.data?.order_id || '';
      console.log(`[E2E] payment_url from API: ${paymentUrl}`);
      console.log(`[E2E] order_id from API: ${orderId}`);

      // Step 11: Fallback URL extraction
      if (!paymentUrl) {
        console.log('[E2E] Step 11: payment_url empty, trying fallback extraction...');

        const windowUrl = await page.evaluate(
          () => (window as any)._waffoPaymentUrl || '',
        );
        console.log(`[E2E] window._waffoPaymentUrl: ${windowUrl}`);

        if (windowUrl) {
          paymentUrl = windowUrl;
        } else {
          const orderAction =
            responseBody.data?.order_action ||
            responseBody.data?.waffo_action ||
            responseBody.data?.subscriptionAction ||
            '';
          console.log(`[E2E] Trying parseRedirectUrl on action: ${orderAction}`);
          paymentUrl = parseRedirectUrl(orderAction);
        }
        console.log(`[E2E] Final payment_url after fallback: ${paymentUrl}`);
      }

      // Step 12: Log all captured data
      console.log('[E2E] Step 12: Captured data summary:');
      console.log(`[E2E]   payment_url: ${paymentUrl}`);
      console.log(`[E2E]   order_id: ${orderId}`);
      console.log(`[E2E]   tunnel_url: ${process.env.TUNNEL_URL || '(from global-setup)'}`);

      expect(paymentUrl).toBeTruthy();
      expect(orderId).toBeTruthy();

      // Restore window.open before navigating away
      await page.evaluate(() => {
        if ((window as any)._originalOpen) {
          window.open = (window as any)._originalOpen;
        }
      });

      // Step 13: Navigate to Waffo checkout page
      console.log(`[E2E] Step 13: Navigating to payment URL: ${paymentUrl}`);
      await page.goto(paymentUrl, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      console.log(`[E2E] Arrived at checkout page: ${page.url()}`);

      // Screenshot checkout page
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-101-checkout.png',
      });

      // Step 14: Complete payment flow (no 3DS)
      console.log('[E2E] Step 14: Completing payment flow (no 3DS)...');
      const paymentSuccess = await completePaymentFlow(page, false);
      console.log(`[E2E] Payment flow result: ${paymentSuccess}`);

      // Screenshot after payment
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-101-after-payment.png',
      });

      // Step 15: Verify order status via webhook
      console.log(`[E2E] Step 15: Polling for order success (orderId=${orderId})...`);
      const orderSuccess = await waitForSubscriptionOrderSuccess(
        BACKEND_BASE_URL,
        orderId,
      );
      console.log(`[E2E] Order verification result: ${orderSuccess}`);

      // Step 16: Assert success
      expect(orderSuccess).toBe(true);
      console.log('[E2E] TC-FLOW-101 PASSED: Subscription payment succeeded without 3DS');

      // Step 17: Final screenshot
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-101-final.png',
      });
    } finally {
      // Cleanup: Disable test plan if we created one
      if (createdPlanId) {
        console.log(`[E2E] Cleanup: Disabling test plan (ID: ${createdPlanId})...`);
        try {
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
          console.log('[E2E] Test plan disabled successfully');
        } catch (cleanupErr) {
          console.log(`[E2E] Warning: Failed to disable test plan: ${cleanupErr}`);
        }
      }

      // Screenshot on any outcome
      try {
        await page.screenshot({
          path: 'e2e-screenshots/subscription-flow-101-cleanup.png',
        });
      } catch {
        // Page may have closed
      }
    }
  });

  test('TC-FLOW-102: 订阅支付完整流程 - Card 支付（3DS 验证）', async ({ page }) => {
    test.slow();
    console.log('[E2E] ========== TC-FLOW-102: Card 支付（3DS 验证） ==========');

    let createdPlanId: number | null = null;

    try {
      // Step 1: Login
      console.log('[E2E] Step 1: Logging in as admin...');
      await loginAsAdmin(page);
      console.log('[E2E] Login successful');

      // Step 2: Navigate to topup page
      console.log('[E2E] Step 2: Navigating to /console/topup...');
      await page.goto('/console/topup', { waitUntil: 'networkidle' });
      console.log(`[E2E] Current URL: ${page.url()}`);

      // Step 3: Ensure subscription plan exists
      console.log('[E2E] Step 3: Checking for existing subscription plans...');
      const existingPlans = await page.evaluate(async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || -1;
        const res = await fetch('/api/subscription/admin/plans', {
          headers: { 'New-Api-User': String(userId) },
        });
        const data = await res.json();
        return data.data || [];
      });
      console.log(`[E2E] Found ${existingPlans.length} existing plans`);

      const hasPlans =
        existingPlans.length > 0 &&
        existingPlans.some((p: any) => p.plan?.enabled);
      console.log(`[E2E] Has enabled plans: ${hasPlans}`);

      if (!hasPlans) {
        console.log('[E2E] No enabled plans found, creating test plan...');
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
                title: 'E2E Payment Flow Test Plan (3DS)',
                subtitle: 'Auto-created for E2E 3DS payment flow testing',
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
        console.log(`[E2E] Created test plan with ID: ${createdPlanId}`);
        await page.reload({ waitUntil: 'networkidle' });
        console.log('[E2E] Page reloaded after plan creation');
      }

      // Step 4: Wait for Card button to confirm getTopupInfo loaded (waffoPayMethods configured)
      console.log('[E2E] Step 4: Waiting for Card button (confirms enableWaffoTopUp=true)...');
      const waffoButton = page.getByRole('button', { name: 'Card' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });
      console.log('[E2E] Waffo button is visible');

      // Step 5: Click first subscribe button to open modal
      console.log('[E2E] Step 5: Clicking subscribe button...');
      const subscribeButton = page
        .getByRole('button', { name: '立即订阅' })
        .first();
      await expect(subscribeButton).toBeVisible({ timeout: 10000 });
      await subscribeButton.click();
      console.log('[E2E] Subscribe button clicked');

      // Step 6: Wait for modal
      console.log('[E2E] Step 6: Waiting for subscription modal...');
      await page.waitForSelector('text=购买订阅套餐', { timeout: 5000 });
      console.log('[E2E] Modal opened successfully');

      // Step 7: Set up API response interception
      console.log('[E2E] Step 7: Setting up API response interception...');
      const paymentResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/subscription/waffo/pay') &&
          resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      // Step 8: Intercept window.open to capture payment URL
      console.log('[E2E] Step 8: Intercepting window.open...');
      await page.evaluate(() => {
        (window as any)._waffoPaymentUrl = '';
        (window as any)._originalOpen = window.open;
        window.open = (url?: string | URL) => {
          (window as any)._waffoPaymentUrl = url ? String(url) : '';
          console.log('[E2E-browser] window.open intercepted:', url);
          return null;
        };
      });

      // Step 9: Click Waffo payment button (label is '确认支付' when Waffo is the only method, 'Waffo' otherwise)
      console.log('[E2E] Step 9: Clicking Waffo payment button...');
      const cardButton = page.getByRole('button', { name: /确认支付|Waffo/ });
      await expect(cardButton).toBeVisible({ timeout: 5000 });
      await cardButton.click();
      console.log('[E2E] Waffo payment button clicked');

      // Step 10: Wait for API response and extract data
      console.log('[E2E] Step 10: Waiting for API response...');
      const response = await paymentResponsePromise;
      console.log(`[E2E] API response status: ${response.status()}`);

      // Handle rate-limited responses (429 returns empty body)
      expect(response.status()).not.toBe(429);
      const responseText = await response.text();
      console.log(`[E2E] API response body: ${responseText}`);
      const responseBody = JSON.parse(responseText);

      let paymentUrl = responseBody.data?.payment_url || '';
      const orderId = responseBody.data?.order_id || '';
      console.log(`[E2E] payment_url from API: ${paymentUrl}`);
      console.log(`[E2E] order_id from API: ${orderId}`);

      // Step 11: Fallback URL extraction
      if (!paymentUrl) {
        console.log('[E2E] Step 11: payment_url empty, trying fallback extraction...');

        const windowUrl = await page.evaluate(
          () => (window as any)._waffoPaymentUrl || '',
        );
        console.log(`[E2E] window._waffoPaymentUrl: ${windowUrl}`);

        if (windowUrl) {
          paymentUrl = windowUrl;
        } else {
          const orderAction =
            responseBody.data?.order_action ||
            responseBody.data?.waffo_action ||
            responseBody.data?.subscriptionAction ||
            '';
          console.log(`[E2E] Trying parseRedirectUrl on action: ${orderAction}`);
          paymentUrl = parseRedirectUrl(orderAction);
        }
        console.log(`[E2E] Final payment_url after fallback: ${paymentUrl}`);
      }

      // Step 12: Log all captured data
      console.log('[E2E] Step 12: Captured data summary:');
      console.log(`[E2E]   payment_url: ${paymentUrl}`);
      console.log(`[E2E]   order_id: ${orderId}`);
      console.log(`[E2E]   tunnel_url: ${process.env.TUNNEL_URL || '(from global-setup)'}`);

      expect(paymentUrl).toBeTruthy();
      expect(orderId).toBeTruthy();

      // Restore window.open before navigating away
      await page.evaluate(() => {
        if ((window as any)._originalOpen) {
          window.open = (window as any)._originalOpen;
        }
      });

      // Step 13: Navigate to Waffo checkout page
      console.log(`[E2E] Step 13: Navigating to payment URL: ${paymentUrl}`);
      await page.goto(paymentUrl, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      console.log(`[E2E] Arrived at checkout page: ${page.url()}`);

      // Screenshot checkout page
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-102-checkout.png',
      });

      // Step 14: Complete payment flow (with 3DS)
      console.log('[E2E] Step 14: Completing payment flow (with 3DS)...');
      const paymentSuccess = await completePaymentFlow(page, true);
      console.log(`[E2E] Payment flow result: ${paymentSuccess}`);

      // Screenshot after payment
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-102-after-payment.png',
      });

      // Step 15: Verify order status via webhook
      console.log(`[E2E] Step 15: Polling for order success (orderId=${orderId})...`);
      const orderSuccess = await waitForSubscriptionOrderSuccess(
        BACKEND_BASE_URL,
        orderId,
      );
      console.log(`[E2E] Order verification result: ${orderSuccess}`);

      // Step 16: Assert success
      expect(orderSuccess).toBe(true);
      console.log('[E2E] TC-FLOW-102 PASSED: Subscription payment succeeded with 3DS');

      // Step 17: Final screenshot
      await page.screenshot({
        path: 'e2e-screenshots/subscription-flow-102-final.png',
      });
    } finally {
      // Cleanup: Disable test plan if we created one
      if (createdPlanId) {
        console.log(`[E2E] Cleanup: Disabling test plan (ID: ${createdPlanId})...`);
        try {
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
          console.log('[E2E] Test plan disabled successfully');
        } catch (cleanupErr) {
          console.log(`[E2E] Warning: Failed to disable test plan: ${cleanupErr}`);
        }
      }

      // Screenshot on any outcome
      try {
        await page.screenshot({
          path: 'e2e-screenshots/subscription-flow-102-cleanup.png',
        });
      } catch {
        // Page may have closed
      }
    }
  });
});
