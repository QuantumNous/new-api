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
 * 后端接口：GET /api/user/topup?page=1&size=... （通配）
 */
async function mockTopupList(page: Page, records: ReturnType<typeof makeTopUpRecord>[]) {
  await page.route(`${BACKEND_BASE}/api/user/topup*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: records,
        total: records.length,
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
 * 打开充值历史弹窗。
 * 管理员账单历史入口：充值页顶部或通过 URL 参数。
 */
async function openTopupHistory(page: Page) {
  await page.goto('/console/topup?show_history=true', { waitUntil: 'networkidle' });
  // 等待弹窗出现
  await page.waitForSelector('.semi-modal', { timeout: 15000 });
}

// ===================== 测试用例 =====================

test.describe('TC-REFUND: Waffo 退款 UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-001: success + Waffo 订单显示退款按钮', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'success', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    // 找到对应行，验证有「退款」按钮
    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row.getByRole('button', { name: '退款' })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-001-success.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-002: partial_refunded + Waffo 订单显示退款按钮', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'partial_refunded', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row.getByRole('button', { name: '退款' })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-002-partial.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-003: refunding 状态不显示退款按钮（已修复 bug）', async ({ page }) => {
    const record = makeTopUpRecord({ status: 'refunding', payment_method: 'waffo' });
    await mockTopupList(page, [record]);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await expect(row).toBeVisible({ timeout: 5000 });
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
    await expect(row).toBeVisible({ timeout: 5000 });
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
    await expect(row).toBeVisible({ timeout: 5000 });
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
    await page.waitForSelector('text=发起退款', { timeout: 5000 });

    // 验证三个金额显示正确
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    await expect(modal.getByText('$10.00')).toBeVisible(); // 原始金额
    await expect(modal.getByText('$2.00')).toBeVisible();  // 已退款
    await expect(modal.getByText('$8.00')).toBeVisible();  // 可退余额

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-006-amounts.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-007: 退款金额为 0 时，提交被 Toast 拦截', async ({ page }) => {
    const record = makeTopUpRecord({ id: 99002, status: 'success', payment_method: 'waffo' });
    await mockTopupList(page, [record]);
    await mockRefundList(page, record.id as number, []);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await row.getByRole('button', { name: '退款' }).click();
    await page.waitForSelector('text=发起退款', { timeout: 5000 });

    // 将退款金额清零
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    const amountInput = modal.locator('.semi-input-number-suffix input').first();
    await amountInput.fill('0');

    // 点击确认退款
    await modal.getByRole('button', { name: '确认退款' }).click();

    // 应弹出 error Toast
    await expect(
      page.locator('.semi-toast-content, [class*="toast"]').filter({
        hasText: /退款金额必须大于 0/,
      })
    ).toBeVisible({ timeout: 3000 });

    // 弹窗保持打开
    await expect(modal).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-007-zero-amount.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-008: 退款金额超出可退余额，提交被 Toast 拦截', async ({ page }) => {
    const record = makeTopUpRecord({ id: 99003, status: 'success', payment_method: 'waffo', money: 10 });
    await mockTopupList(page, [record]);
    // 无历史退款，可退余额 = $10
    await mockRefundList(page, record.id as number, []);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await row.getByRole('button', { name: '退款' }).click();
    await page.waitForSelector('text=发起退款', { timeout: 5000 });

    // 输入超额金额 $10.5（超出 $10）
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    const amountInput = modal.locator('.semi-input-number-suffix input').first();
    await amountInput.fill('10.5');

    await modal.getByRole('button', { name: '确认退款' }).click();

    await expect(
      page.locator('.semi-toast-content, [class*="toast"]').filter({
        hasText: /超出可退余额/,
      })
    ).toBeVisible({ timeout: 3000 });

    await expect(modal).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-refund-008-exceed.png' });
  });

  // ------------------------------------------------------------------
  test('TC-REFUND-009: 正常提交退款，Toast 提示成功，弹窗关闭', async ({ page }) => {
    const record = makeTopUpRecord({ id: 99004, status: 'success', payment_method: 'waffo', money: 10 });
    await mockTopupList(page, [record]);
    await mockRefundList(page, record.id as number, []);
    await mockRefundSubmit(page, true);

    await openTopupHistory(page);

    const row = page.locator('tr', { hasText: record.trade_no });
    await row.getByRole('button', { name: '退款' }).click();
    await page.waitForSelector('text=发起退款', { timeout: 5000 });

    // 使用默认金额（$10，与可退余额一致）直接提交
    const modal = page.locator('.semi-modal', { hasText: '发起退款' });
    await modal.getByRole('button', { name: '确认退款' }).click();

    // 成功 Toast 出现
    await expect(
      page.locator('.semi-toast-content, [class*="toast"]').filter({
        hasText: /退款申请已提交/,
      })
    ).toBeVisible({ timeout: 5000 });

    // 退款弹窗关闭
    await expect(modal).not.toBeVisible({ timeout: 5000 });

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
      await expect(row).toBeVisible({ timeout: 5000 });
      await expect(row.getByText(tc.expectedText)).toBeVisible();

      await page.screenshot({
        path: `e2e-screenshots/${tc.screenshot}.png`,
      });
    });
  }
});
