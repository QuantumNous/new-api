import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';
import { getAdminCookie, ADMIN_USER_ID } from '../helpers/admin-session';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { completePaymentFlow, parseRedirectUrl } from '../helpers/waffo-checkout';
import { waitForTopupOrderSuccess } from '../helpers/order-verify';

const DB_PATH = '/Users/zhaozhongyuan/workspace/github/new-api/one-api.db';

function readOptionFromDB(key: string): string | null {
  try {
    const result = execSync(
      `sqlite3 "${DB_PATH}" "SELECT value FROM options WHERE key='${key}';"`,
      { encoding: 'utf-8' }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Waffo 退款功能 E2E 测试
 *
 * 覆盖范围：
 *   UI-1:  退款弹窗预填值验证（$1 订单 → quota_deduction 预填 500000）
 *   S0:    非 Waffo 订单退款被拒（边界）
 *   S1:    退款成功，额度回退（quota_deduction=500000，FULLY_REFUNDED → quota -500000）
 *   S2:    退款失败，额度不变（REFUND_FAILED → quota 不变）
 *   S3:    退款不退额度（quota_deduction=0，FULLY_REFUNDED → quota 不变）
 *   S4:    退款退指定额度（quota_deduction=250000，FULLY_REFUNDED → quota -250000）
 *
 * 测试分层：
 *   UI-1 / S0：通过 page.route() mock 后端接口，隔离对真实数据的依赖，可在任何环境运行。
 *
 *   S1-S4：真实集成测试，依赖完整的 Waffo Sandbox 环境。流程：
 *     1. 注入测试 RSA 公钥（WaffoSandboxPublicKey）
 *        使 E2E 测试可控地模拟 webhook 签名验证；私钥保持真实凭证不变，
 *        确保 Waffo SDK 可以正常调用退款 API
 *     2. 调用 POST /api/user/self/topup/waffo/pay 创建 pending TopUp（即使 SDK 调用失败也会写入 DB）
 *     3. 调用 POST /api/user/topup/complete（AdminCompleteTopUp）把 TopUp 状态推进为 success
 *     4. 调用 POST /api/user/topup/refund（AdminRefundTopUp）发起退款，获取 refundRequestId
 *        此步骤调用 Waffo Sandbox API，需要有效凭证；若失败则 test.skip()
 *     5. 用测试私钥签名 REFUND_NOTIFICATION webhook，POST 到 /api/waffo/webhook
 *     6. 验证用户 quota 变化
 *     7. afterAll 还原密钥
 */

const BACKEND_BASE = 'http://localhost:3000';

// ========== 常量 ==========

/** $1 订单对应的 quota 换算（QuotaPerUnit = 500_000） */
const QUOTA_PER_UNIT = 500_000;

// ========== RSA 签名工具（纯 Node.js crypto，与 waffo-sdk utils.Sign 算法一致） ==========

/**
 * 使用 PKCS#8 DER Base64 私钥对字符串进行 SHA256withRSA (RSASSA-PKCS1-v1_5) 签名。
 * 返回 Base64 编码的签名字符串。
 */
function signWithPrivateKey(data: string, pkcs8Base64: string): string {
  const keyDer = Buffer.from(pkcs8Base64, 'base64');
  const privateKey = crypto.createPrivateKey({
    key: keyDer,
    format: 'der',
    type: 'pkcs8',
  });
  const sign = crypto.createSign('SHA256');
  sign.update(data, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * 生成一个临时的 RSA-2048 密钥对，返回 PKCS#8 / X.509 Base64 编码。
 * 每次测试 beforeAll 调用，保证与 Waffo 无关的自签密钥对。
 */
function generateTestKeyPair(): { privateKeyBase64: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    privateKeyBase64: privateKey.toString('base64'),
    publicKeyBase64: publicKey.toString('base64'),
  };
}

// ========== 后端 fetch 辅助 ==========

async function safeJson(resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text();
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

/** 获取管理员用户当前 quota */
async function getUserQuota(userId: number, cookie: string): Promise<number> {
  const resp = await fetch(`${BACKEND_BASE}/api/user/${userId}`, {
    headers: { Cookie: cookie, 'New-Api-User': String(userId) },
  });
  const body = await safeJson(resp);
  if (!body.success) throw new Error(`getUserQuota failed: ${JSON.stringify(body)}`);
  return body.data.quota as number;
}

/** 通过管理员 API 更新单个 Option */
async function updateOption(cookie: string, key: string, value: string): Promise<void> {
  const resp = await fetch(`${BACKEND_BASE}/api/option/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
    body: JSON.stringify({ key, value }),
  });
  const body = await safeJson(resp);
  if (!body.success) throw new Error(`updateOption(${key}) failed: ${JSON.stringify(body)}`);
}

/** 读取当前 Option（只返回非 Key/Secret/Token 后缀字段） */
async function getOption(cookie: string, key: string): Promise<string | null> {
  const resp = await fetch(`${BACKEND_BASE}/api/option/`, {
    headers: { Cookie: cookie, 'New-Api-User': ADMIN_USER_ID },
  });
  const body = await safeJson(resp);
  if (!body.success) return null;
  const options: { key: string; value: string }[] = body.data ?? [];
  const found = options.find((o) => o.key === key);
  return found?.value ?? null;
}

/** 向 /api/waffo/webhook 发送用指定私钥签名的 webhook */
async function postSignedWebhook(
  bodyObj: object,
  privateKeyBase64: string
): Promise<{ statusCode: number; body: string }> {
  const bodyStr = JSON.stringify(bodyObj);
  const signature = signWithPrivateKey(bodyStr, privateKeyBase64);
  const resp = await fetch(`${BACKEND_BASE}/api/waffo/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SIGNATURE': signature,
    },
    body: bodyStr,
  });
  const text = await resp.text();
  return { statusCode: resp.status, body: text };
}

/** 通过管理员充值列表查找指定 trade_no 的订单 */
async function getTopUpByTradeNo(
  cookie: string,
  tradeNo: string
): Promise<{ id: number; status: string; user_id: number } | null> {
  const resp = await fetch(`${BACKEND_BASE}/api/user/topup?p=1&page_size=100`, {
    headers: { Cookie: cookie, 'New-Api-User': ADMIN_USER_ID },
  });
  const body = await safeJson(resp);
  if (!body.success) return null;
  const items: { id: number; status: string; trade_no: string; user_id: number }[] =
    body.data?.items ?? [];
  return items.find((o) => o.trade_no === tradeNo) ?? null;
}

/** 调用 AdminCompleteTopUp 将 pending 订单标记为 success。
 *  若订单已是 success（Waffo SDK 直接完成），则忽略该错误。 */
async function adminCompleteTopUp(cookie: string, tradeNo: string): Promise<void> {
  const resp = await fetch(`${BACKEND_BASE}/api/user/topup/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
    body: JSON.stringify({ trade_no: tradeNo }),
  });
  const body = await safeJson(resp);
  if (!body.success) {
    const msg: string = body.message ?? '';
    // 幂等：已经是 success 状态，忽略
    if (msg.includes('已成功') || msg.includes('不是待支付') || msg.includes('状态错误')) {
      console.log(`[adminCompleteTopUp] Order already completed, skipping: ${msg}`);
      return;
    }
    throw new Error(`adminCompleteTopUp failed: ${JSON.stringify(body)}`);
  }
}

/** 调用 AdminRefundTopUp 发起退款，成功则返回 refundRequestId */
async function adminInitiateRefund(
  cookie: string,
  topupId: number,
  refundAmount: number,
  quotaDeduction: number,
  reason = 'E2E test refund'
): Promise<string> {
  const resp = await fetch(`${BACKEND_BASE}/api/user/topup/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
    body: JSON.stringify({
      topup_id: topupId,
      refund_amount: refundAmount,
      quota_deduction: quotaDeduction,
      reason,
    }),
  });
  const body = await safeJson(resp);
  if (!body.success) throw new Error(`adminInitiateRefund failed: ${JSON.stringify(body)}`);
  return body.data.refund_request_id as string;
}

// ========== Mock 辅助（UI 级别测试用） ==========

function makeTopUpRecord(overrides: Record<string, unknown>) {
  return {
    id: Math.floor(Math.random() * 90000) + 10000,
    user_id: 1,
    amount: 1,
    money: 1.0,
    trade_no: `TRADE-${Date.now()}`,
    acquiring_order_id: 'ACQ-MOCK-001',
    payment_method: 'waffo',
    create_time: Math.floor(Date.now() / 1000) - 3600,
    complete_time: Math.floor(Date.now() / 1000) - 3500,
    status: 'success',
    ...overrides,
  };
}

async function mockTopupList(page: Page, records: ReturnType<typeof makeTopUpRecord>[]) {
  await page.route('**/api/user/topup*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: records, total: records.length },
      }),
    });
  });
}

async function mockRefundList(page: Page, topUpId: number, refunds: object[]) {
  await page.route(`**/api/user/topup/${topUpId}/refunds`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: refunds }),
    });
  });
}

async function openTopupHistory(page: Page) {
  await page.goto('/console/topup?show_history=true', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.semi-modal', { timeout: 20000 });
}

// ==========================================================================
// UI-1: 退款弹窗预填值验证
// ==========================================================================

test.describe('UI-1: 退款弹窗预填值验证', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('UI-1: $1 Waffo 订单退款弹窗，扣减额度 (Token) 预填值为 500000', async ({ page }) => {
    const record = makeTopUpRecord({
      id: 88001,
      amount: 1,
      money: 1.0,
      status: 'success',
      payment_method: 'waffo',
    });
    await mockTopupList(page, [record]);
    await mockRefundList(page, record.id as number, []);

    await openTopupHistory(page);

    // 找到对应行，点击退款按钮
    const row = page.locator('tr', { hasText: record.trade_no as string });
    await row.getByRole('button', { name: '退款' }).click();

    // 等待退款弹窗出现
    await page.waitForSelector('text=发起退款', { timeout: 8000 });

    const modal = page.locator('.semi-modal', { hasText: '发起退款' });

    // 验证「扣减额度」字段存在
    const quotaLabel = modal.getByText(/扣减额度/);
    await expect(quotaLabel).toBeVisible({ timeout: 5000 });

    // 弹窗中有两个 InputNumber：退款金额 和 扣减额度。取第 2 个 input 的值。
    const inputs = modal.locator('input[type="text"], input:not([type])');
    const quotaInput = inputs.nth(1);
    await expect(quotaInput).toBeVisible({ timeout: 5000 });
    const prefillValue = await quotaInput.inputValue();
    expect(Number(prefillValue.replace(/,/g, ''))).toBe(QUOTA_PER_UNIT);

    await page.screenshot({ path: 'e2e-screenshots/ui-1-refund-dialog-prefill.png' });
  });
});

// ==========================================================================
// S0: 非 Waffo 订单退款被拒（边界）
// ==========================================================================

test.describe('S0: 非 Waffo 订单退款被拒', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('S0-UI: stripe 订单行不显示退款按钮', async ({ page }) => {

    const record = makeTopUpRecord({
      id: 88002,
      status: 'success',
      payment_method: 'stripe',
    });
    await mockTopupList(page, [record]);
    await mockRefundList(page, record.id as number, []);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no as string });
    await expect(row).toBeVisible({ timeout: 5000 });
    // UI 层：非 Waffo 支付方式不应显示退款按钮
    await expect(row.getByRole('button', { name: '退款' })).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/s0-stripe-no-refund-btn.png' });
  });

});


// ==========================================================================
// S1-S4: 退款全流程 E2E 测试（UI 驱动）
//
// 流程：
//   a. setupSuccessTopUp：
//      1. 登录 → 充值页选择 Dana 支付
//      2. 跳转 Waffo checkout → handleMockCashier 点"Payment succeeded"
//      3. waitForTopupOrderSuccess 等 webhook 回调，订单变 success（真实 acquiringOrderId）
//      4. 返回 { tradeNo, topupId, userId }
//
//   b. 每个测试：
//      1. setupSuccessTopUp 创建真实支付成功订单
//      2. 打开账单弹窗 → 找到该订单行 → 点"退款"按钮
//      3. 设置 quota_deduction → 点"确认退款"（触发真实 Waffo 退款 API）
//      4. S1/S3/S4：等待 Waffo 沙盒发 REFUND webhook 回来 → 轮询 refund 状态
//         S2：先手动发 FAILED webhook（竞争赢过 Waffo 的 SUCCESS）→ 验证 quota 不变
//      5. 验证用户 quota 变化
// ==========================================================================

/** 等待退款记录变为终态（success 或 failed） */
async function waitForRefundCompletion(
  topupId: number,
  cookie: string,
  timeoutMs = 60000
): Promise<{ status: string } | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(`${BACKEND_BASE}/api/user/topup/${topupId}/refunds`, {
      headers: { Cookie: cookie, 'New-Api-User': ADMIN_USER_ID },
    });
    const body = await safeJson(resp);
    if (body.success) {
      const refunds = (body.data as { status: string }[]) ?? [];
      const terminal = refunds.find((r) => r.status === 'success' || r.status === 'failed');
      if (terminal) return terminal;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

test.describe('S1-S4: 退款全流程 E2E 测试（UI 驱动）', () => {
  let adminCookie: string;
  let sandboxPrivateKey: string;

  test.beforeAll(async () => {
    if (!adminCookie) {
      adminCookie = await getAdminCookie(BACKEND_BASE);
    }
    sandboxPrivateKey = readOptionFromDB('WaffoSandboxPrivateKey') ?? '';
  });

  /**
   * UI 驱动创建真实支付成功订单：
   * 1. 登录 → 充值页选 Dana → 跳转 checkout
   * 2. handleMockCashier 点"Payment succeeded"
   * 3. waitForTopupOrderSuccess 等 webhook 回调
   * 返回 { tradeNo, topupId, userId }
   */
  async function setupSuccessTopUp(page: Page): Promise<{
    tradeNo: string;
    topupId: number;
    userId: number;
  }> {
    // Step 1: Login
    await loginAsAdmin(page);

    // Step 2: Navigate to topup page
    await page.goto('/console/topup', { waitUntil: 'domcontentloaded' });

    // Step 3: Fill amount = 10 USD（与现有支付流程测试一致）
    const amountInput = page.locator('.semi-input-number input').first();
    await amountInput.fill('10');
    await new Promise((r) => setTimeout(r, 500));

    // Step 4: Intercept window.open for payment URL
    await page.evaluate(() => {
      (window as any)._waffoPaymentUrl = '';
      window.open = (url?: string | URL) => {
        (window as any)._waffoPaymentUrl = typeof url === 'string' ? url : url?.toString() || '';
        return null;
      };
    });

    // Step 5: Listen for the pay API response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/user/waffo/pay') && resp.request().method() === 'POST',
      { timeout: 30000 }
    );

    // Step 6: Click Dana button
    const danaButton = page.getByRole('button', { name: 'Dana' });
    await expect(danaButton).toBeVisible({ timeout: 15000 });
    await danaButton.click();

    // Step 7: Extract payment URL and order ID
    const apiResp = await responsePromise;
    const respText = await apiResp.text();
    const respBody = JSON.parse(respText);
    expect(respBody.message).toBe('success');

    const tradeNo: string = respBody.data?.order_id ?? '';
    let paymentUrl: string = respBody.data?.payment_url ?? '';
    if (!paymentUrl) paymentUrl = parseRedirectUrl(respBody.data?.order_action);
    if (!paymentUrl) {
      paymentUrl = await page.evaluate(() => (window as any)._waffoPaymentUrl || '');
    }
    expect(paymentUrl).toBeTruthy();
    expect(tradeNo).toBeTruthy();
    console.log(`[setupSuccessTopUp] tradeNo=${tradeNo}, paymentUrl=${paymentUrl}`);

    // Step 8: Navigate to checkout and simulate payment success
    await page.goto(paymentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const paid = await completePaymentFlow(page, false);
    expect(paid).toBe(true);

    // Step 9: Wait for webhook callback (order status → success in DB)
    const success = await waitForTopupOrderSuccess(BACKEND_BASE, tradeNo, 180000);
    expect(success).toBe(true);
    console.log(`[setupSuccessTopUp] Order ${tradeNo} confirmed success in DB`);

    // Step 10: Get topupId and userId from DB
    const topup = await getTopUpByTradeNo(adminCookie, tradeNo);
    expect(topup).not.toBeNull();

    return { tradeNo, topupId: topup!.id, userId: topup!.user_id };
  }

  /**
   * 在账单弹窗中发起退款
   * 打开 /console/topup?show_history=true → 找到 tradeNo 对应行 → 点退款
   * → 设置 quota_deduction → 点确认退款
   */
  async function initiateRefundViaUI(
    page: Page,
    tradeNo: string,
    quotaDeduction: number
  ): Promise<void> {
    await page.goto('/console/topup?show_history=true', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.semi-modal', { timeout: 15000 });

    // 找到该订单行并点退款
    const row = page.locator('tr', { hasText: tradeNo });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: '退款' }).click();

    // 等待退款弹窗
    await page.waitForSelector('text=发起退款', { timeout: 8000 });
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });

    // 设置扣减额度（第 2 个 input）
    const quotaInput = modal.locator('input').nth(1);
    await quotaInput.fill(String(quotaDeduction));

    // 填写退款原因（Waffo 要求 refundReason 不能为空）
    const reasonInput = modal.locator('input[placeholder]').last();
    await reasonInput.fill('E2E test refund');
    await new Promise((r) => setTimeout(r, 300));

    // 用 JS click 绕过 Semi UI 双层 Modal 的 z-index 拦截
    await new Promise((r) => setTimeout(r, 500));
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes('确认退款'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) throw new Error('确认退款 button not found in DOM');
    console.log(`[initiateRefundViaUI] Refund initiated for ${tradeNo}, quota_deduction=${quotaDeduction}`);
  }

  // ------------------------------------------------------------------
  // S1: 退款成功，额度回退
  // ------------------------------------------------------------------

  test('S1: 退款成功，额度回退', async ({ page }) => {
    test.slow();

    const { tradeNo, topupId, userId } = await setupSuccessTopUp(page);
    const quotaBefore = await getUserQuota(userId, adminCookie);
    console.log(`[S1] topupId=${topupId}, quotaBefore=${quotaBefore}`);

    // amount=10 ($10)，对应 quota = 10 * QUOTA_PER_UNIT = 5,000,000
    const fullQuota = 10 * QUOTA_PER_UNIT;
    await initiateRefundViaUI(page, tradeNo, fullQuota);

    const refund = await waitForRefundCompletion(topupId, adminCookie, 90000);
    expect(refund).not.toBeNull();
    expect(refund!.status).toBe('success');

    const quotaAfter = await getUserQuota(userId, adminCookie);
    console.log(`[S1] quotaAfter=${quotaAfter}, delta=${quotaBefore - quotaAfter}`);
    expect(quotaBefore - quotaAfter).toBe(fullQuota);

    await page.screenshot({ path: 'e2e-screenshots/s1-refund-success-quota-deducted.png' });
  });

  // ------------------------------------------------------------------
  // S2: 退款失败，额度不变
  // 直接在 DB 插入 pending refund（绕过 Waffo SDK），然后发 FAILED webhook。
  // 修复 race condition 后，真实调 SDK 会导致 Waffo 立即发 SUCCESS webhook，
  // 无法再手动发 FAILED 抢先，因此 S2 用 DB 直插法专门测试 FAILED webhook 处理路径。
  // ------------------------------------------------------------------

  test('S2: 退款失败，额度不变', async ({ page }) => {
    test.slow();

    const { tradeNo, topupId, userId } = await setupSuccessTopUp(page);
    const quotaBefore = await getUserQuota(userId, adminCookie);
    console.log(`[S2] topupId=${topupId}, quotaBefore=${quotaBefore}`);

    // 直接在 DB 插入 pending refund 记录（不调 Waffo SDK，避免 SUCCESS webhook 竞争）
    const refundRequestId = `REFUND-${topupId}-${Date.now()}-e2efail`;
    const now = Math.floor(Date.now() / 1000);
    try {
      execSync(
        `sqlite3 "${DB_PATH}" "INSERT INTO refunds (top_up_id, user_id, refund_request_id, refund_amount, quota_deduction, reason, status, operator_id, create_time, complete_time) VALUES (${topupId}, ${userId}, '${refundRequestId}', 10.0, ${10 * QUOTA_PER_UNIT}, 'E2E test FAILED', 'pending', 1, ${now}, 0);"`
      );
      console.log(`[S2] Inserted pending refund: ${refundRequestId}`);
    } catch (e) {
      test.skip(true, `SKIP: DB insert failed: ${e}`);
      return;
    }

    // 发 FAILED webhook → backend 应将 refund 标记为 failed，不扣 quota
    const webhookBody = {
      eventType: 'REFUND_NOTIFICATION',
      result: {
        refundRequestId,
        merchantRefundOrderId: `MRF-${refundRequestId}`,
        acquiringOrderId: '',
        refundStatus: 'ORDER_REFUND_FAILED',
        refundAmount: '10.00',
      },
    };
    const wh = await postSignedWebhook(webhookBody, sandboxPrivateKey);
    expect(wh.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 1000));

    const quotaAfter = await getUserQuota(userId, adminCookie);
    console.log(`[S2] quotaAfter=${quotaAfter}, delta=${quotaBefore - quotaAfter}`);
    expect(quotaAfter).toBe(quotaBefore); // quota 不变

    await page.screenshot({ path: 'e2e-screenshots/s2-refund-failed-quota-unchanged.png' });
  });

  // ------------------------------------------------------------------
  // S3: 退款不退额度（quota_deduction=0）
  // ------------------------------------------------------------------

  test('S3: 退款不退额度（quota_deduction=0）', async ({ page }) => {
    test.slow();

    const { tradeNo, topupId, userId } = await setupSuccessTopUp(page);
    const quotaBefore = await getUserQuota(userId, adminCookie);
    console.log(`[S3] topupId=${topupId}, quotaBefore=${quotaBefore}`);

    // 通过 UI 发起退款，quota_deduction=0（不扣额度）
    await initiateRefundViaUI(page, tradeNo, 0);

    const refund = await waitForRefundCompletion(topupId, adminCookie, 90000);
    expect(refund).not.toBeNull();
    expect(refund!.status).toBe('success');

    const quotaAfter = await getUserQuota(userId, adminCookie);
    console.log(`[S3] quotaAfter=${quotaAfter}, delta=${quotaBefore - quotaAfter}`);
    expect(quotaAfter).toBe(quotaBefore); // quota 不变

    await page.screenshot({ path: 'e2e-screenshots/s3-zero-deduction-quota-unchanged.png' });
  });

  // ------------------------------------------------------------------
  // S4: 退款退指定额度（quota_deduction=250000）
  // ------------------------------------------------------------------

  test('S4: 退款退指定额度（quota_deduction=250000）', async ({ page }) => {
    test.slow();

    const { tradeNo, topupId, userId } = await setupSuccessTopUp(page);
    const quotaBefore = await getUserQuota(userId, adminCookie);
    console.log(`[S4] topupId=${topupId}, quotaBefore=${quotaBefore}`);

    const partialDeduction = 10 * QUOTA_PER_UNIT / 2; // 2,500,000（$5 worth）

    // 通过 UI 发起退款，quota_deduction=250000
    await initiateRefundViaUI(page, tradeNo, partialDeduction);

    const refund = await waitForRefundCompletion(topupId, adminCookie, 90000);
    expect(refund).not.toBeNull();
    expect(refund!.status).toBe('success');

    const quotaAfter = await getUserQuota(userId, adminCookie);
    console.log(`[S4] quotaAfter=${quotaAfter}, delta=${quotaBefore - quotaAfter}`);
    expect(quotaBefore - quotaAfter).toBe(partialDeduction);

    await page.screenshot({ path: 'e2e-screenshots/s4-partial-deduction-quota.png' });
  });

  // ------------------------------------------------------------------
  // S0-API: 非 Waffo 订单退款被拒（API 层）
  // ------------------------------------------------------------------

  test('S0-API: 向不存在的订单发起退款，后端返回业务错误', async () => {
    const resp = await fetch(`${BACKEND_BASE}/api/user/topup/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        'New-Api-User': ADMIN_USER_ID,
      },
      body: JSON.stringify({
        topup_id: 999999999,
        refund_amount: 1.0,
        quota_deduction: 500000,
        reason: 'E2E boundary test',
      }),
    });

    const body = await safeJson(resp);
    expect(body.success).toBe(false);
    expect(body.message || body.data).toMatch(/不存在|not found/i);
  });
});
