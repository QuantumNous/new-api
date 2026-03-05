import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';
import {
  completePaymentFlow,
  parseRedirectUrl,
  TEST_CARD,
  TEST_3DS_CARD,
} from '../helpers/waffo-checkout';
import { waitForTopupOrderSuccess } from '../helpers/order-verify';

/**
 * Waffo 充值支付全流程 E2E 测试
 *
 * 验证完整的支付生命周期：
 *   1. 前端登录 -> 进入充值页 -> 填写金额 -> 点击 Waffo -> 捕获 payment_url + order_id
 *   2. 跳转 Waffo 结账页 -> 填写卡号 -> 提交 -> 处理 3DS -> 等待结果
 *   3. 轮询后端管理接口，确认订单状态从 pending 变为 success（证明 webhook 回调成功）
 *
 * 隧道和回调 URL 由 global-setup.ts / global-teardown.ts 统一管理，
 * 所有 *-flow.spec.ts 共享同一个 cloudflared 隧道。
 */

const BACKEND_BASE_URL = 'http://localhost:3000';

test.describe('Waffo 充值支付全流程 E2E', () => {

  test('TC-FLOW-001: 充值支付完整流程 - 标准卡（无3DS）', async ({ page }) => {
    test.slow();

    let orderId = '';

    try {
      // ==================== Step 1: Login ====================
      console.log('[E2E] TC-FLOW-001: Step 1 - Logging in as admin...');
      await loginAsAdmin(page);
      console.log('[E2E] TC-FLOW-001: Login successful');

      // ==================== Step 2: Navigate to topup page ====================
      console.log('[E2E] TC-FLOW-001: Step 2 - Navigating to topup page...');
      await page.goto('/console/topup', {
        waitUntil: 'load',
        timeout: 30000,
      });
      console.log('[E2E] TC-FLOW-001: Topup page loaded, URL:', page.url());

      // ==================== Step 3: Wait for Waffo button ====================
      console.log('[E2E] TC-FLOW-001: Step 3 - Waiting for Waffo button to be visible...');
      const waffoButton = page.getByRole('button', { name: 'Card' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });
      console.log('[E2E] TC-FLOW-001: Waffo button is visible (getTopupInfo loaded)');

      // ==================== Step 4: Fill amount ====================
      console.log('[E2E] TC-FLOW-001: Step 4 - Filling topup amount...');
      const amountInput = page.locator('.semi-input-number input').first();
      await amountInput.fill('10');
      console.log('[E2E] TC-FLOW-001: Amount filled: 10');

      // ==================== Step 5: Intercept API response and window.open ====================
      console.log('[E2E] TC-FLOW-001: Step 5 - Setting up API response interception...');

      // Intercept window.open to prevent new tab opening
      await page.evaluate(() => {
        (window as any)._waffoPaymentUrl = '';
        window.open = (url?: string | URL) => {
          (window as any)._waffoPaymentUrl = typeof url === 'string' ? url : url?.toString() || '';
          console.log('[E2E-PAGE] window.open intercepted, URL:', (window as any)._waffoPaymentUrl);
          return null;
        };
      });
      console.log('[E2E] TC-FLOW-001: window.open intercepted');

      // Set up response listener for the Waffo pay API
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/user/waffo/pay') &&
          resp.request().method() === 'POST',
        { timeout: 30000 }
      );

      // ==================== Step 6: Click Waffo button ====================
      console.log('[E2E] TC-FLOW-001: Step 6 - Clicking Waffo button...');
      await waffoButton.click();
      console.log('[E2E] TC-FLOW-001: Waffo button clicked, waiting for API response...');

      // ==================== Step 7: Extract payment URL and order ID ====================
      console.log('[E2E] TC-FLOW-001: Step 7 - Extracting payment data from API response...');
      const response = await responsePromise;
      console.log('[E2E] TC-FLOW-001: API response status:', response.status());

      // Handle rate-limited responses (429 returns empty body)
      expect(response.status()).not.toBe(429);
      const responseText = await response.text();
      console.log('[E2E] TC-FLOW-001: API response body:', responseText);
      const responseBody = JSON.parse(responseText);

      // API uses message-based success format (not success: true)
      expect(responseBody.message).toBe('success');

      // Extract payment_url from response data
      let paymentUrl = responseBody.data?.payment_url || '';
      orderId = responseBody.data?.order_id || '';

      console.log('[E2E] TC-FLOW-001: payment_url from response:', paymentUrl);
      console.log('[E2E] TC-FLOW-001: order_id from response:', orderId);

      // If payment_url is empty, try alternative fields
      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-001: payment_url is empty, trying order_action...');
        paymentUrl = parseRedirectUrl(responseBody.data?.order_action);
        console.log('[E2E] TC-FLOW-001: payment_url from order_action:', paymentUrl);
      }

      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-001: payment_url still empty, trying waffo_action...');
        paymentUrl = parseRedirectUrl(responseBody.data?.waffo_action);
        console.log('[E2E] TC-FLOW-001: payment_url from waffo_action:', paymentUrl);
      }

      // If still empty, check window._waffoPaymentUrl (intercepted from window.open)
      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-001: Trying intercepted window.open URL...');
        const interceptedUrl = await page.evaluate(
          () => (window as any)._waffoPaymentUrl || ''
        );
        paymentUrl = interceptedUrl;
        console.log('[E2E] TC-FLOW-001: payment_url from window.open:', paymentUrl);
      }

      expect(paymentUrl).toBeTruthy();
      expect(orderId).toBeTruthy();
      console.log('[E2E] TC-FLOW-001: Final payment_url:', paymentUrl);
      console.log('[E2E] TC-FLOW-001: Final order_id:', orderId);

      // ==================== Step 8: Navigate to Waffo checkout page ====================
      console.log('[E2E] TC-FLOW-001: Step 8 - Navigating to Waffo checkout page...');
      await page.goto(paymentUrl, { waitUntil: 'networkidle', timeout: 30000 });
      console.log('[E2E] TC-FLOW-001: Checkout page loaded, URL:', page.url());

      // Wait for the checkout page content to be ready
      await page.waitForTimeout(3000);
      console.log('[E2E] TC-FLOW-001: Checkout page title:', await page.title());

      // ==================== Step 9: Complete payment flow (no 3DS) ====================
      console.log('[E2E] TC-FLOW-001: Step 9 - Completing payment flow (no 3DS)...');
      const paymentSuccess = await completePaymentFlow(page, false);
      console.log('[E2E] TC-FLOW-001: Payment flow completed, checkout result:', paymentSuccess);

      // ==================== Step 10: Verify webhook callback via order status ====================
      console.log('[E2E] TC-FLOW-001: Step 10 - Verifying webhook callback (polling order status)...');
      console.log('[E2E] TC-FLOW-001: Polling for order_id:', orderId);
      const orderSuccess = await waitForTopupOrderSuccess(
        BACKEND_BASE_URL,
        orderId
      );
      console.log('[E2E] TC-FLOW-001: Order status verification result:', orderSuccess);

      expect(orderSuccess).toBe(true);
      console.log('[E2E] TC-FLOW-001: PASSED - Full payment flow + webhook callback verified');
    } finally {
      // Always take screenshot for debugging
      console.log('[E2E] TC-FLOW-001: Taking final screenshot...');
      await page.screenshot({
        path: 'e2e-screenshots/tc-flow-001-standard-card-final.png',
        fullPage: true,
      });
      console.log('[E2E] TC-FLOW-001: Screenshot saved');
    }
  });

  test('TC-FLOW-002: 充值支付完整流程 - 3DS 验证卡', async ({ page }) => {
    test.slow();

    let orderId = '';

    try {
      // ==================== Step 1: Login ====================
      console.log('[E2E] TC-FLOW-002: Step 1 - Logging in as admin...');
      await loginAsAdmin(page);
      console.log('[E2E] TC-FLOW-002: Login successful');

      // ==================== Step 2: Navigate to topup page ====================
      console.log('[E2E] TC-FLOW-002: Step 2 - Navigating to topup page...');
      await page.goto('/console/topup', {
        waitUntil: 'load',
        timeout: 30000,
      });
      console.log('[E2E] TC-FLOW-002: Topup page loaded, URL:', page.url());

      // ==================== Step 3: Wait for Waffo button ====================
      console.log('[E2E] TC-FLOW-002: Step 3 - Waiting for Waffo button to be visible...');
      const waffoButton = page.getByRole('button', { name: 'Card' });
      await expect(waffoButton).toBeVisible({ timeout: 30000 });
      console.log('[E2E] TC-FLOW-002: Waffo button is visible (getTopupInfo loaded)');

      // ==================== Step 4: Fill amount ====================
      console.log('[E2E] TC-FLOW-002: Step 4 - Filling topup amount...');
      const amountInput = page.locator('.semi-input-number input').first();
      await amountInput.fill('10');
      console.log('[E2E] TC-FLOW-002: Amount filled: 10');

      // ==================== Step 5: Intercept API response and window.open ====================
      console.log('[E2E] TC-FLOW-002: Step 5 - Setting up API response interception...');

      // Intercept window.open to prevent new tab opening
      await page.evaluate(() => {
        (window as any)._waffoPaymentUrl = '';
        window.open = (url?: string | URL) => {
          (window as any)._waffoPaymentUrl = typeof url === 'string' ? url : url?.toString() || '';
          console.log('[E2E-PAGE] window.open intercepted, URL:', (window as any)._waffoPaymentUrl);
          return null;
        };
      });
      console.log('[E2E] TC-FLOW-002: window.open intercepted');

      // Set up response listener for the Waffo pay API
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/user/waffo/pay') &&
          resp.request().method() === 'POST',
        { timeout: 30000 }
      );

      // ==================== Step 6: Click Waffo button ====================
      console.log('[E2E] TC-FLOW-002: Step 6 - Clicking Waffo button...');
      await waffoButton.click();
      console.log('[E2E] TC-FLOW-002: Waffo button clicked, waiting for API response...');

      // ==================== Step 7: Extract payment URL and order ID ====================
      console.log('[E2E] TC-FLOW-002: Step 7 - Extracting payment data from API response...');
      const response = await responsePromise;
      console.log('[E2E] TC-FLOW-002: API response status:', response.status());

      // Handle rate-limited responses (429 returns empty body)
      expect(response.status()).not.toBe(429);
      const responseText = await response.text();
      console.log('[E2E] TC-FLOW-002: API response body:', responseText);
      const responseBody = JSON.parse(responseText);

      // API uses message-based success format (not success: true)
      expect(responseBody.message).toBe('success');

      // Extract payment_url from response data
      let paymentUrl = responseBody.data?.payment_url || '';
      orderId = responseBody.data?.order_id || '';

      console.log('[E2E] TC-FLOW-002: payment_url from response:', paymentUrl);
      console.log('[E2E] TC-FLOW-002: order_id from response:', orderId);

      // If payment_url is empty, try alternative fields
      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-002: payment_url is empty, trying order_action...');
        paymentUrl = parseRedirectUrl(responseBody.data?.order_action);
        console.log('[E2E] TC-FLOW-002: payment_url from order_action:', paymentUrl);
      }

      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-002: payment_url still empty, trying waffo_action...');
        paymentUrl = parseRedirectUrl(responseBody.data?.waffo_action);
        console.log('[E2E] TC-FLOW-002: payment_url from waffo_action:', paymentUrl);
      }

      // If still empty, check window._waffoPaymentUrl (intercepted from window.open)
      if (!paymentUrl) {
        console.log('[E2E] TC-FLOW-002: Trying intercepted window.open URL...');
        const interceptedUrl = await page.evaluate(
          () => (window as any)._waffoPaymentUrl || ''
        );
        paymentUrl = interceptedUrl;
        console.log('[E2E] TC-FLOW-002: payment_url from window.open:', paymentUrl);
      }

      expect(paymentUrl).toBeTruthy();
      expect(orderId).toBeTruthy();
      console.log('[E2E] TC-FLOW-002: Final payment_url:', paymentUrl);
      console.log('[E2E] TC-FLOW-002: Final order_id:', orderId);

      // ==================== Step 8: Navigate to Waffo checkout page ====================
      console.log('[E2E] TC-FLOW-002: Step 8 - Navigating to Waffo checkout page...');
      await page.goto(paymentUrl, { waitUntil: 'networkidle', timeout: 30000 });
      console.log('[E2E] TC-FLOW-002: Checkout page loaded, URL:', page.url());

      // Wait for the checkout page content to be ready
      await page.waitForTimeout(3000);
      console.log('[E2E] TC-FLOW-002: Checkout page title:', await page.title());

      // ==================== Step 9: Complete payment flow (with 3DS) ====================
      console.log('[E2E] TC-FLOW-002: Step 9 - Completing payment flow (with 3DS)...');
      const paymentSuccess = await completePaymentFlow(page, true);
      console.log('[E2E] TC-FLOW-002: Payment flow completed, checkout result:', paymentSuccess);

      // ==================== Step 10: Verify webhook callback via order status ====================
      console.log('[E2E] TC-FLOW-002: Step 10 - Verifying webhook callback (polling order status)...');
      console.log('[E2E] TC-FLOW-002: Polling for order_id:', orderId);
      const orderSuccess = await waitForTopupOrderSuccess(
        BACKEND_BASE_URL,
        orderId
      );
      console.log('[E2E] TC-FLOW-002: Order status verification result:', orderSuccess);

      expect(orderSuccess).toBe(true);
      console.log('[E2E] TC-FLOW-002: PASSED - Full 3DS payment flow + webhook callback verified');
    } finally {
      // Always take screenshot for debugging
      console.log('[E2E] TC-FLOW-002: Taking final screenshot...');
      await page.screenshot({
        path: 'e2e-screenshots/tc-flow-002-3ds-card-final.png',
        fullPage: true,
      });
      console.log('[E2E] TC-FLOW-002: Screenshot saved');
    }
  });
});
