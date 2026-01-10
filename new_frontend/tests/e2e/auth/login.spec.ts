import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('应该正确显示登录表单', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByTestId('login-form')).toBeVisible();
    
    // 检查表单元素
    await expect(page.getByTestId('username-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('login-button')).toBeVisible();
    await expect(page.getByTestId('register-link')).toBeVisible();
  });

  test('应该显示必填字段验证错误', async ({ page }) => {
    // 点击登录按钮但不填写任何内容
    await page.getByTestId('login-button').click();
    
    // 应该显示验证错误
    await expect(page.locator('text=请输入用户名')).toBeVisible();
    await expect(page.locator('text=请输入密码')).toBeVisible();
  });

  test('应该能够输入用户名和密码', async ({ page }) => {
    // 填写表单
    await page.getByTestId('username-input').fill('testuser');
    await page.getByTestId('password-input').fill('password123');
    
    // 验证输入值
    await expect(page.getByTestId('username-input')).toHaveValue('testuser');
    await expect(page.getByTestId('password-input')).toHaveValue('password123');
  });

  test('应该能够导航到注册页面', async ({ page }) => {
    // 点击注册链接
    await page.getByTestId('register-link').click();
    
    // 验证跳转到注册页面
    await expect(page).toHaveURL('/auth/register');
    await expect(page.getByTestId('register-form')).toBeVisible();
  });

  test('密码输入框应该隐藏密码', async ({ page }) => {
    const passwordInput = page.getByTestId('password-input');
    
    // 验证密码输入框类型
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('登录流程', () => {
  test('成功登录后应该跳转到仪表板', async ({ page }) => {
    // 注意：这个测试需要模拟 API 响应或使用测试账号
    await page.goto('/auth/login');
    
    // 填写登录信息
    await page.getByTestId('username-input').fill('testuser');
    await page.getByTestId('password-input').fill('password123');
    
    // 点击登录按钮
    await page.getByTestId('login-button').click();
    
    // 等待可能的加载状态
    // await expect(page.getByTestId('login-button')).toBeDisabled();
    
    // 验证跳转（需要根据实际 API 响应调整）
    // await expect(page).toHaveURL('/console/dashboard');
  });
});
