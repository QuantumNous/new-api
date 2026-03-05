import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Waffo 充值页 UI 布局变更 E2E 测试
 *
 * 覆盖范围（本次 PR 新增功能）：
 *   TC-UI-001: 仅有 Waffo 时，按钮显示在「选择支付方式」区域（无独立 Waffo 区块）
 *   TC-UI-002: 同时有非 Waffo 支付方式时，Waffo 按钮显示在独立的「Waffo 充值」区域
 *   TC-UI-003: 所有支付均禁用时，显示「暂无可用支付方式」提示
 *   TC-UI-004: 支付回跳时 ?show_history=true 自动打开账单弹窗，且参数被清除
 *   TC-UI-005: Waffo 支付按钮图标尺寸统一为 36×36
 *
 * 说明：
 *   TC-UI-001 / TC-UI-002 / TC-UI-003 依赖 /api/user/topup/info 的响应内容，
 *   通过 page.route() 拦截并返回指定 mock 数据，隔离对实际服务配置的依赖。
 */

// ===================== Mock 数据构造辅助 =====================

/** 构造 waffo_pay_methods 列表 */
function makeWaffoPayMethods(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    name: `MockMethod-${i + 1}`,
    payMethodType: 'CREDITCARD',
    payMethodName: '',
    icon: '',
  }));
}

/** 拦截 topup info 接口并注入 mock 响应 */
async function mockTopupInfo(
  page: import('@playwright/test').Page,
  overrides: Record<string, unknown>
) {
  await page.route('**/api/user/topup/info', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          enable_online_topup: true,
          enable_waffo_topup: false,
          enable_stripe_topup: false,
          enable_creem_topup: false,
          pay_methods: [],
          waffo_pay_methods: null,
          min_topup: 1,
          stripe_min_topup: 1,
          waffo_min_topup: 1,
          amount_options: [],
          discount: {},
          ...overrides,
        },
      }),
    });
  });
}

// ===================== 测试用例 =====================

test.describe('TC-UI: Waffo 充值页 UI 布局', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ------------------------------------------------------------------
  test('TC-UI-001: 仅有 Waffo 时，按钮显示在「选择支付方式」区域', async ({ page }) => {
    const waffoMethods = makeWaffoPayMethods(2);

    // 模拟：只有 Waffo，pay_methods 中只含 waffo 类型
    await mockTopupInfo(page, {
      enable_waffo_topup: true,
      waffo_pay_methods: waffoMethods,
      pay_methods: [{ name: 'Waffo', type: 'waffo', color: '' }],
    });

    await page.goto('/console/topup', { waitUntil: 'load' });

    // 「选择支付方式」区域应出现 Waffo 按钮
    await expect(page.getByRole('button', { name: /MockMethod-1/i }))
      .toBeVisible({ timeout: 2000 });

    // 页面上不应有独立的「Waffo 充值」Form.Slot 标题
    await expect(page.getByText('Waffo 充值')).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-ui-001-only-waffo.png' });
  });

  // ------------------------------------------------------------------
  test('TC-UI-002: 有其他支付方式时，Waffo 在独立区域显示', async ({ page }) => {
    const waffoMethods = makeWaffoPayMethods(1);

    // 模拟：同时有 ePay（非 waffo 类型）和 Waffo
    await mockTopupInfo(page, {
      enable_waffo_topup: true,
      waffo_pay_methods: waffoMethods,
      pay_methods: [
        { name: '支付宝', type: 'epay', color: '' },
        { name: 'Waffo', type: 'waffo', color: '' },
      ],
    });

    await page.goto('/console/topup', { waitUntil: 'load' });

    // 「选择支付方式」区域应显示支付宝
    await expect(page.getByRole('button', { name: /支付宝/i }))
      .toBeVisible({ timeout: 2000 });

    // 独立的「Waffo 充值」Form.Slot 应出现
    await expect(page.getByText('Waffo 充值')).toBeVisible({ timeout: 2000 });

    // Waffo 按钮也应出现
    await expect(page.getByRole('button', { name: /MockMethod-1/i }))
      .toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-ui-002-mixed-payment.png' });
  });

  // ------------------------------------------------------------------
  test('TC-UI-003: 所有支付均禁用，显示「暂无可用支付方式」', async ({ page }) => {
    // 模拟：没有任何支付方式，Waffo 也禁用
    await mockTopupInfo(page, {
      enable_waffo_topup: false,
      waffo_pay_methods: [],
      pay_methods: [],
    });

    await page.goto('/console/topup', { waitUntil: 'load' });

    await expect(
      page.getByText(/暂无可用的支付方式/)
    ).toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-ui-003-no-payment.png' });
  });

  // ------------------------------------------------------------------
  test('TC-UI-004: ?show_history=true 自动打开账单弹窗，参数随后被清除', async ({ page }) => {
    // mock 充值列表避免真实后端影响，同时加速 modal 内容加载
    await page.route(/\/api\/user\/topup(\?|$)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0, page: 1, page_size: 10 },
        }),
      });
    });

    await page.goto('/console/topup?show_history=true', { waitUntil: 'load' });

    // 账单历史弹窗应自动弹出（Modal 标题含「充值记录」或类似文案）
    const historyModal = page.locator('.semi-modal', {
      hasText: /充值记录|账单|Top.?[Uu]p.*[Hh]istory/i,
    });
    // modal 在 React 处理 URL 参数后弹出，给 5000ms 窗口
    await expect(historyModal).toBeVisible({ timeout: 5000 });

    // URL 中的 show_history 参数应已被清除（replace: true）
    await expect(page).not.toHaveURL(/show_history/);

    await page.screenshot({ path: 'e2e-screenshots/tc-ui-004-show-history.png' });
  });

  // ------------------------------------------------------------------
  test('TC-UI-005: Waffo 支付按钮图标尺寸统一为 36×36', async ({ page }) => {
    // 注意：图标 Base64 填充一个有效 data URI 以确保 img 被渲染
    const ICON_DATA_URI =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const waffoMethods = [
      { name: 'CardWithIcon', payMethodType: 'CREDITCARD', payMethodName: '', icon: ICON_DATA_URI },
    ];

    await mockTopupInfo(page, {
      enable_waffo_topup: true,
      waffo_pay_methods: waffoMethods,
      pay_methods: [
        { name: '支付宝', type: 'epay', color: '' },
        { name: 'Waffo', type: 'waffo', color: '' },
      ],
    });

    await page.goto('/console/topup', { waitUntil: 'load' });

    // 等待 Waffo 图标 img 出现
    const waffoIcon = page.locator(
      '[data-testid="waffo-pay-section"] img, .semi-form-field img[src^="data:image/"]'
    ).first();

    // 宽松匹配：查找充值页中 style 含 width: 36 的 img
    // mock 响应虽即时但 React 需要一次事件循环才能更新 state，给 5000ms
    const iconImg = page.locator('img[src^="data:image/"]').first();
    await expect(iconImg).toBeVisible({ timeout: 5000 });

    // 验证 inline style 尺寸为 36×36
    const width = await iconImg.evaluate(
      (el) => (el as HTMLImageElement).style.width
    );
    const height = await iconImg.evaluate(
      (el) => (el as HTMLImageElement).style.height
    );

    expect(width).toBe('36px');
    expect(height).toBe('36px');

    await page.screenshot({ path: 'e2e-screenshots/tc-ui-005-icon-size.png' });
  });
});
