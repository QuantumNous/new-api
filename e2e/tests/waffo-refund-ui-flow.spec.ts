import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 退款 UI E2E 测试
 *
 * 覆盖范围（本次 PR 新增功能）：
 *   TC-REFUND-001: success + Waffo 订单显示退款按钮
 *   TC-REFUND-002: partial_refunded + Waffo 订单显示退款按钮
 *   TC-REFUND-003: refunding + Waffo 订单不显示退款按钮（已修复 bug）
 *   TC-REFUND-004: pending 订单只显示「补单」，不显示退款
 *   TC-REFUND-005: 非 Waffo 支付（如 stripe）success 订单不显示退款按钮
 *   TC-REFUND-006: 退款弹窗展示正确的可退余额（已部分退款）
 *   TC-REFUND-007: 退款金额为 0 时提交被拦截
 *   TC-REFUND-008: 退款金额超出可退余额时被拦截
 *   TC-REFUND-009: 正常提交退款，弹窗关闭，列表刷新
 *   TC-STATUS-001~003: refunded / partial_refunded / refunding 状态标签显示正确
 *
 * 说明：
 *   所有需要特定订单状态的用例均通过 page.route() mock 管理员充值列表接口，
 *   以隔离对后端真实数据的依赖。
 *   退款提交接口（/api/user/topup/refund）同样被 mock，不触发实际退款。
 */

const BACKEND_BASE = 'http://localhost:3000';

// ===================== Mock 辅助 =====================

/** 构造一条 TopUp mock 记录 */
function makeTopUpRecord(overrides: Record<string, unknown>) {
  return {
    id: Math.floor(Math.random() * 90000) + 10000,
    user_id: 1,
    amount: 100,
    money: 10.0,
    trade_no: `TRADE-${Date.now()}`,
    acquiring_order_id: 'ACQ-MOCK-001',
    payment_method: 'waffo',
    create_time: Math.floor(Date.now() / 1000) - 3600,
    complete_time: Math.floor(Date.now() / 1000) - 3500,
    status: 'success',
    ...overrides,
  };
}

/**
 * 拦截管理员充值列表接口，注入指定 mock 订单列表。
 * 后端接口：GET /api/user/topup?p=1&page_size=... （通配）
 * 响应格式：{ success: true, data: { items: [...], total: N, page: N, page_size: N } }
 */
async function mockTopupList(page: Page, records: ReturnType<typeof makeTopUpRecord>[]) {
  // 只拦截充值列表接口（GET /api/user/topup?...），避免误拦截 /api/user/topup/info
  await page.route(/\/api\/user\/topup(\?|$)/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: records, total: records.length, page: 1, page_size: 10 },
      }),
    });
  });
}

/** 拦截退款记录查询接口（GET /api/user/topup/:id/refunds） */
async function mockRefundList(
  page: Page,
  topUpId: number,
  refunds: {
    refund_amount: number;
    status: 'success' | 'pending' | 'failed';
  }[]
) {
  await page.route(
    `${BACKEND_BASE}/api/user/topup/${topUpId}/refunds`,
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: refunds }),
      });
    }
  );
}

/** 拦截退款提交接口（POST /api/user/topup/refund） */
async function mockRefundSubmit(page: Page, succeed: boolean) {
  await page.route(`${BACKEND_BASE}/api/user/topup/refund`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        succeed
          ? { success: true, data: { refund_request_id: 'REFUND-MOCK-001' } }
          : { success: false, message: '发起退款失败' }
      ),
    });
  });
}

/**
 * mock /api/user/topup/info，隔离充值页对真实后端的依赖。
 * 并行 worker 下真实后端响应可能变慢，导致 2000ms 断言超时，必须 mock。
 */
async function mockTopupInfo(page: Page) {
  await page.route('**/api/user/topup/info', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          enable_online_topup: false,
          enable_waffo_topup: false,
          enable_stripe_topup: false,
          enable_creem_topup: false,
          pay_methods: [],
          waffo_pay_methods: [],
          min_topup: 1,
          waffo_min_topup: 1,
          amount_options: [],
          discount: {},
        },
      }),
    });
  });
}

/**
 * 打开充值历史弹窗。
 * 管理员账单历史入口：充值页顶部或通过 URL 参数。
 */
async function openTopupHistory(page: Page) {
  await page.goto('/console/topup?show_history=true', { waitUntil: 'load' });

  // 如果 modal 未在 8s 内出现（show_history useEffect 偶发未触发），立即重试该步骤。
  // 重试时 JS bundle 已缓存，modal 通常 <200ms 出现；无需等整个测试超时再重试。
  const STEP_TIMEOUT = 8000;
  let appeared = false;
  try {
    await page.waitForSelector('.semi-modal', { timeout: STEP_TIMEOUT });
    appeared = true;
  } catch { /* swallow, retry below */ }

  if (!appeared) {
    // show_history param 已被第一次 useEffect 消费，重新 goto 重新注入
    await page.goto('/console/topup?show_history=true', { waitUntil: 'load' });
    await page.waitForSelector('.semi-modal', { timeout: STEP_TIMEOUT });
  }
}

// ===================== 测试用例 =====================

test.describe('TC-REFUND: Waffo 退款 UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // 隔离 topup/info，消除并行 worker 下真实后端响应慢导致的断言超时
    await mockTopupInfo(page);
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-001: success + Waffo 订单显示退款按钮', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'success', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    // 找到对应行，验证有「退款」按钮
    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row.getByRole('button', { name: '退款' })).toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-001-success.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-002: partial_refunded + Waffo 订单显示退款按钮', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'partial_refunded', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row.getByRole('button', { name: '退款' })).toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-002-partial.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-003: refunding 状态不显示退款按钮（已修复 bug）', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'refunding', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row).toBeVisible({ timeout: 2000 });
    // 退款按钮不应出现
    await expect(row.getByRole('button', { name: '退款' })).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-003-refunding-no-btn.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-004: pending 订单只有「补单」按钮，无退款', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'pending', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row).toBeVisible({ timeout: 2000 });
    // 有「补单」
    await expect(row.getByRole('button', { name: '补单' })).toBeVisible();
    // 无「退款」
    await expect(row.getByRole('button', { name: '退款' })).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-004-pending.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-005: 非 Waffo（stripe）success 订单不显示退款按钮', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'success', payment_method: 'stripe' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row).toBeVisible({ timeout: 2000 });
    await expect(row.getByRole('button', { name: '退款' })).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-005-stripe.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-006: 退款弹窗展示正确的可退余额（已部分退款 $2，原单 $10）', async ({ page }) => {
    const record = makeTopUpRecord({
      id: 99001,
      status: 'partial_refunded',
      payment_method: 'waffo',
      money: 10.0,
    });
    await mockTopupList(page, [record]);
    // mock 已退款 $2
    await mockRefundList(page, record.id as number, [
      { refund_amount: 2.0, status: 'success' },
    ]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await row.getByRole('button', { name: '退款' }).click();

    // 等待退款弹窗出现
    await page.waitForSelector('text=发起退款', { timeout: 2000 });

    // 验证三个金额显示正确
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    await expect(modal.getByText('$10.00')).toBeVisible(); // 原始金额
    await expect(modal.getByText('$2.00')).toBeVisible();  // 已退款
    await expect(modal.getByText('$8.00')).toBeVisible();  // 可退余额

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-006-amounts.png' });
  });

  // ------------------------------------------------------------------
  // TC-REFUND-007 和 TC-REFUND-008 已从 UI 测试中移除：
  // InputNumber 的 min={0.01}/max={remaining} 约束会立即 clamp 无效输入值，
  // 导致 refundAmount <= 0 和 > remaining 两个校验路径通过正常 UI 操作无法到达。
  // 这两个校验作为服务端 /api/user/topup/refund 的防御层依然有意义，
  // 可通过后端单元测试或集成测试覆盖。
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  test('TC-REFUND-009: 正常提交退款，Toast 提示成功，弹窗关闭', async ({ page }) => {
    const record = makeTopUpRecord({ id: 99004, status: 'success', payment_method: 'waffo', money: 10 });
    await mockTopupList(page, [record]);
    await mockRefundList(page, record.id as number, []);
    await mockRefundSubmit(page, true);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await row.getByRole('button', { name: '退款' }).click();
    await page.waitForSelector('text=发起退款', { timeout: 2000 });

    // 使用默认金额（$10，与可退余额一致）直接提交
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    await modal.locator('button').filter({ hasText: '确认退款' }).click();

    // 成功 Toast 出现（使用 .semi-toast-content-text 避免 strict mode violation）
    await expect(
      page.locator('.semi-toast-content-text').filter({
        hasText: /退款申请已提交/,
      })
    ).toBeVisible({ timeout: 2000 });

    // 退款弹窗关闭
    await expect(modal).not.toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-009-success.png' });
  });

  // ------------------------------------------------------------------
  // TC-STATUS 系列：状态标签显示正确
  // ------------------------------------------------------------------

  const statusCases: Array<{
    id: string;
    status: string;
    expectedText: string;
    screenshot: string;
  }> = [
    {
      id: 'TC-STATUS-001',
      status: 'refunded',
      expectedText: '已退款',
      screenshot: 'tc-status-001-refunded',
    },
    {
      id: 'TC-STATUS-002',
      status: 'partial_refunded',
      expectedText: '部分退款',
      screenshot: 'tc-status-002-partial-refunded',
    },
    {
      id: 'TC-STATUS-003',
      status: 'refunding',
      expectedText: '退款中',
      screenshot: 'tc-status-003-refunding',
    },
  ];

  for (const tc of statusCases) {
    test(`${tc.id}: 状态「${tc.status}」正确显示为「${tc.expectedText}」`, async ({ page }) => {
      const record = makeTopUpRecord({ status: tc.status, payment_method: 'waffo' });
      await mockTopupList(page, [record]);

      await openTopupHistory(page);

      // 在对应订单行找到状态标签
      const row = page.locator('tr', { hasText: record.trade_no });
      await expect(row).toBeVisible({ timeout: 2000 });
      await expect(row.getByText(tc.expectedText)).toBeVisible();

      await page.screenshot({
        path: `e2e-screenshots/${tc.screenshot}.png`,
      });
    });
  }
});
