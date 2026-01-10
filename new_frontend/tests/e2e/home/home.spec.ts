import { test, expect } from '@playwright/test';

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该正确显示首页内容', async ({ page }) => {
    // 检查页面存在
    await expect(page.getByTestId('home-page')).toBeVisible();
    
    // 检查导航栏
    await expect(page.getByTestId('nav-login-button')).toBeVisible();
    await expect(page.getByTestId('nav-register-button')).toBeVisible();
    
    // 检查 Hero 区域按钮
    await expect(page.getByTestId('hero-get-started-button')).toBeVisible();
    await expect(page.getByTestId('hero-view-docs-button')).toBeVisible();
  });

  test('应该显示功能特性卡片', async ({ page }) => {
    // 检查功能卡片
    await expect(page.getByTestId('feature-card-多渠道统一管理')).toBeVisible();
    await expect(page.getByTestId('feature-card-企业级安全')).toBeVisible();
    await expect(page.getByTestId('feature-card-实时监控统计')).toBeVisible();
    await expect(page.getByTestId('feature-card-OpenAI 兼容')).toBeVisible();
  });

  test('应该显示定价方案', async ({ page }) => {
    // 检查定价卡片
    await expect(page.getByTestId('pricing-card-免费版')).toBeVisible();
    await expect(page.getByTestId('pricing-card-专业版')).toBeVisible();
    await expect(page.getByTestId('pricing-card-企业版')).toBeVisible();
  });

  test('点击登录按钮应该跳转到登录页面', async ({ page }) => {
    await page.getByTestId('nav-login-button').click();
    await expect(page).toHaveURL('/auth/login');
  });

  test('点击注册按钮应该跳转到注册页面', async ({ page }) => {
    await page.getByTestId('nav-register-button').click();
    await expect(page).toHaveURL('/auth/register');
  });

  test('点击查看文档按钮应该跳转到 API 文档', async ({ page }) => {
    await page.getByTestId('hero-view-docs-button').click();
    await expect(page).toHaveURL('/api-docs');
  });

  test('点击立即开始按钮应该跳转到注册页面', async ({ page }) => {
    await page.getByTestId('hero-get-started-button').click();
    await expect(page).toHaveURL('/auth/register');
  });
});

test.describe('首页响应式设计', () => {
  test('在移动端应该正确显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // 验证页面仍然可见
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('nav-login-button')).toBeVisible();
  });

  test('在平板端应该正确显示', async ({ page }) => {
    // 设置平板端视口
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // 验证页面仍然可见
    await expect(page.getByTestId('home-page')).toBeVisible();
  });
});
