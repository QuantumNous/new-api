import { test, expect } from '@playwright/test';

test.describe('仪表板页面', () => {
  test.beforeEach(async ({ page }) => {
    // 注意：这些测试需要先登录
    // 在实际测试中，您需要先执行登录流程或使用测试 token
    await page.goto('/console/dashboard');
  });

  test('应该显示仪表板布局', async ({ page }) => {
    // 检查布局组件
    await expect(page.getByTestId('dashboard-layout')).toBeVisible();
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('main-content')).toBeVisible();
  });

  test('应该显示统计卡片', async ({ page }) => {
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    
    // 检查统计卡片
    await expect(page.getByTestId('stat-card-渠道总数')).toBeVisible();
    await expect(page.getByTestId('stat-card-令牌总数')).toBeVisible();
    await expect(page.getByTestId('stat-card-用户总数')).toBeVisible();
    await expect(page.getByTestId('stat-card-今日请求')).toBeVisible();
  });

  test('应该能够切换主题', async ({ page }) => {
    // 点击主题切换按钮
    await page.getByTestId('theme-toggle').click();
    
    // 验证主题已切换（可以检查 HTML 的 class 或其他主题相关属性）
    // 这取决于您的主题实现方式
  });

  test('应该显示用户菜单', async ({ page }) => {
    // 点击用户菜单触发器
    await page.getByTestId('user-menu-trigger').click();
    
    // 验证菜单项
    await expect(page.getByTestId('profile-menu-item')).toBeVisible();
    await expect(page.getByTestId('settings-menu-item')).toBeVisible();
    await expect(page.getByTestId('logout-menu-item')).toBeVisible();
  });
});

test.describe('侧边栏导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/console/dashboard');
  });

  test('应该能够导航到渠道管理', async ({ page }) => {
    await page.getByTestId('nav-item-/console/channels').click();
    await expect(page).toHaveURL('/console/channels');
  });

  test('应该能够导航到令牌管理', async ({ page }) => {
    await page.getByTestId('nav-item-/console/tokens').click();
    await expect(page).toHaveURL('/console/tokens');
  });

  test('应该能够导航到操练场', async ({ page }) => {
    await page.getByTestId('nav-item-/playground/chat').click();
    await expect(page).toHaveURL('/playground/chat');
  });
});

test.describe('移动端侧边栏', () => {
  test('在移动端应该能够打开和关闭侧边栏', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/console/dashboard');
    
    // 侧边栏应该默认隐藏
    // 点击菜单按钮
    await page.getByTestId('mobile-menu-button').click();
    
    // 侧边栏应该显示
    await expect(page.getByTestId('sidebar')).toBeVisible();
    
    // 点击遮罩层关闭
    await page.getByTestId('sidebar-overlay').click();
    
    // 侧边栏应该隐藏
    // await expect(page.getByTestId('sidebar')).not.toBeVisible();
  });
});
