import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Waffo 支付方式配置 E2E 测试
 *
 * 覆盖范围（本次 PR 新增功能）：
 *   TC-PM-001: 添加支付方式（正常路径）
 *   TC-PM-002: 添加支付方式（名称为空校验）
 *   TC-PM-003: 上传图标（≤100KB，正常路径）
 *   TC-PM-004: 上传图标（>100KB，被 100KB 限制拦截）
 *   TC-PM-005: 上传图标后可清除
 *   TC-PM-006: 编辑已有支付方式
 *   TC-PM-007: 删除支付方式
 */

// ===================== 页面导航辅助 =====================

/**
 * 导航到 Waffo 设置页并等待支付方式区块出现。
 * 返回"支付方式"区块的 Locator（用于后续操作范围限定）。
 */
async function goToWaffoPayMethodsSection(page: Page) {
  await page.goto('/console/setting', { waitUntil: 'load' });
  // 等待 Tab 出现（isRoot 判断依赖 localStorage，并发下需要更长等待）
  await page.waitForSelector('text=/支付设置|Payment.*Setting/i', { timeout: 15000 });
  // 切换到「支付设置」选项卡
  await page.locator('text=/支付设置|Payment.*Setting/i').first().click();
  // 等待 Waffo 设置区域加载
  await page.waitForSelector('text=Waffo 设置', { timeout: 5000 });
  // 滚动到支付方式区块（Typography.Title heading=6）
  await page.locator('text=支付方式').first().scrollIntoViewIfNeeded();
}

/** 打开「添加支付方式」弹窗，等待输入框就绪 */
async function openAddModal(page: Page) {
  await page.getByRole('button', { name: /新增支付方式/i }).click();
  await expect(page.locator('.semi-modal-content').getByText('显示名称')).toBeVisible({ timeout: 5000 });
}

/**
 * 在弹窗中填写表单并点击「确定」。
 * name 必填，其余可选。
 */
async function fillPayMethodModal(
  page: Page,
  opts: { name: string; payMethodType?: string; payMethodName?: string }
) {
  // 显示名称输入框：在模态框范围内查找（有多个 Input 同名）
  // 用 input[type="text"] 排除隐藏的 file input（图标上传）
  const modal = page.locator('.semi-modal-content');
  await modal.locator('input[type="text"]').first().fill(opts.name);
  if (opts.payMethodType) {
    await modal.locator('input[type="text"]').nth(1).fill(opts.payMethodType);
  }
  if (opts.payMethodName) {
    await modal.locator('input[type="text"]').nth(2).fill(opts.payMethodName);
  }
  await page.locator('.semi-modal button').filter({ hasText: '确定' }).click();
}

// ===================== 测试用例 =====================

// TC-PM 修改真实 DB，必须串行执行避免数据竞争
test.describe.configure({ mode: 'serial' });

test.describe('TC-PM: Waffo 支付方式配置', () => {
  test.beforeEach(async ({ page }) => {
    // 登录 + 导航设置页 + 表单操作总耗时 >60s，需要 3× 超时 = 180s
    // test.slow() 必须在 beforeEach 里，才能在 retry 时也生效
    test.slow();
    await loginAsAdmin(page);
  });

  // ------------------------------------------------------------------
  test('TC-PM-001: 添加支付方式（正常路径）', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);
    await openAddModal(page);

    const methodName = `TestCard-${Date.now()}`;
    await fillPayMethodModal(page, {
      name: methodName,
      payMethodType: 'CREDITCARD,DEBITCARD',
    });

    // 弹窗应关闭，新行出现在表格中
    await expect(page.getByText(methodName)).toBeVisible({ timeout: 2000 });
    await page.screenshot({ path: 'e2e-screenshots/tc-pm-001-added.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-002: 添加支付方式（名称为空，校验拦截）', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);
    await openAddModal(page);

    // 不填名称直接确定
    await page.locator('.semi-modal button').filter({ hasText: '确定' }).click();

    // 弹窗应保持打开，显示错误提示
    await expect(page.locator('.semi-modal').getByText('显示名称')).toBeVisible();
    // 错误文案（showError 调用的 Toast）
    await expect(page.locator('.semi-toast-content-text')).toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-002-name-empty.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-003: 上传图标（≤100KB，正常路径）', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);
    await openAddModal(page);

    // 创建一个 1×1 像素的最小有效 PNG（< 1 KB）
    const TINY_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
      '+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const tmpFile = path.join(os.tmpdir(), 'tc-pm-003-icon.png');
    fs.writeFileSync(tmpFile, TINY_PNG);

    // 监听 filechooser 并注入小文件
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /上传图片/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpFile);
    fs.unlinkSync(tmpFile);

    // 图标预览应出现（img 元素 with src starting with data:image/）
    await expect(
      page.locator('.semi-modal-content img[src^="data:image/"]')
    ).toBeVisible({ timeout: 2000 });

    // 「清除」按钮出现，「上传图片」变为「重新上传」
    await expect(page.getByRole('button', { name: /重新上传/i })).toBeVisible();
    await expect(page.getByRole('button', { name: '清除' })).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-003-icon-uploaded.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-004: 上传图标（>100KB，被限制拦截）', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);
    await openAddModal(page);

    // 创建一个 150KB 的假 PNG 文件（内容无效但大小超限）
    const LARGE_CONTENT = Buffer.alloc(150 * 1024, 0x42); // 150KB of 'B'
    const tmpFile = path.join(os.tmpdir(), 'tc-pm-004-large-icon.png');
    fs.writeFileSync(tmpFile, LARGE_CONTENT);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /上传图片/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpFile);
    fs.unlinkSync(tmpFile);

    // 应弹出 error Toast，包含「100KB」字样
    await expect(page.locator('.semi-toast-content-text')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.semi-toast-content-text')).toContainText('100KB');

    // 预览图不应出现（图标未被接受）
    await expect(
      page.locator('.semi-modal-content img[src^="data:image/"]')
    ).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-004-icon-rejected.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-005: 上传图标后可清除', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);
    await openAddModal(page);

    // 先上传一个合法图标
    const TINY_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
      '+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const tmpFile = path.join(os.tmpdir(), 'tc-pm-005-icon.png');
    fs.writeFileSync(tmpFile, TINY_PNG);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /上传图片/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpFile);
    fs.unlinkSync(tmpFile);

    await expect(
      page.locator('.semi-modal-content img[src^="data:image/"]')
    ).toBeVisible({ timeout: 2000 });

    // 点击清除
    await page.getByRole('button', { name: '清除' }).click();

    // 预览图消失
    await expect(
      page.locator('.semi-modal-content img[src^="data:image/"]')
    ).not.toBeVisible();
    // 「清除」按钮消失
    await expect(page.getByRole('button', { name: '清除' })).not.toBeVisible();
    // 恢复显示「上传图片」
    await expect(page.getByRole('button', { name: /上传图片/i })).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-005-icon-cleared.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-006: 编辑已有支付方式', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);

    // 先添加一条数据，确保表格有可编辑的行
    await openAddModal(page);
    const originalName = `EditTarget-${Date.now()}`;
    await fillPayMethodModal(page, { name: originalName });
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 2000 });

    // 点击该行的「编辑」按钮
    const row = page.locator('tr', { hasText: originalName });
    await row.getByRole('button', { name: /编辑/i }).click();
    await expect(page.locator('.semi-modal').getByText('显示名称')).toBeVisible({ timeout: 2000 });

    // 修改名称
    const updatedName = `Edited-${Date.now()}`;
    const modal = page.locator('.semi-modal-content');
    await modal.locator('input').first().clear();
    await modal.locator('input').first().fill(updatedName);
    await page.locator('.semi-modal button').filter({ hasText: '确定' }).click();

    // 列表中显示更新后的名称
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(originalName)).not.toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-006-edited.png' });
  });

  // ------------------------------------------------------------------
  test('TC-PM-007: 删除支付方式', async ({ page }) => {
    await goToWaffoPayMethodsSection(page);

    // 先添加一条，确保可删除
    await openAddModal(page);
    const targetName = `ToDelete-${Date.now()}`;
    await fillPayMethodModal(page, { name: targetName });
    await expect(page.getByText(targetName)).toBeVisible({ timeout: 2000 });

    // 点击该行的「删除」按钮
    const row = page.locator('tr', { hasText: targetName });
    await row.getByRole('button', { name: /删除/i }).click();

    // 行应消失
    await expect(page.getByText(targetName)).not.toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: 'e2e-screenshots/tc-pm-007-deleted.png' });
  });
});
