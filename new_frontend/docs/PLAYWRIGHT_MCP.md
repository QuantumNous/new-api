# Playwright MCP 集成说明

> 本文档说明如何使用 Playwright MCP 进行自动化测试

## 📖 什么是 Playwright MCP

Playwright MCP (Model Context Protocol) 是一个通过 MCP 服务器集成的 Playwright 测试工具，允许通过标准化接口进行浏览器自动化测试。

### 核心特性

- ✅ 跨浏览器测试（Chromium, Firefox, WebKit）
- ✅ 自动等待和重试机制
- ✅ 网络拦截和模拟
- ✅ 截图和视频录制
- ✅ 移动设备模拟
- ✅ 并行测试执行

## 🚀 配置 Playwright

### 1. 安装 Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### 2. 配置文件

创建 `playwright.config.ts`：

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 🧪 测试编写规范

### 测试文件结构

```
tests/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── register.spec.ts
│   │   └── oauth.spec.ts
│   ├── console/
│   │   ├── channels.spec.ts
│   │   ├── tokens.spec.ts
│   │   └── users.spec.ts
│   ├── playground/
│   │   └── chat.spec.ts
│   └── fixtures/
│       ├── auth.ts
│       └── data.ts
└── utils/
    ├── helpers.ts
    └── constants.ts
```

### 基础测试示例

#### 1. 登录测试

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('用户登录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('成功登录', async ({ page }) => {
    // 填写登录表单
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'password123');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 验证跳转到仪表板
    await expect(page).toHaveURL('/console/dashboard');
    
    // 验证用户信息显示
    await expect(page.locator('text=testuser')).toBeVisible();
  });

  test('显示错误信息 - 用户名为空', async ({ page }) => {
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=用户名不能为空')).toBeVisible();
  });

  test('显示错误信息 - 密码错误', async ({ page }) => {
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=用户名或密码错误')).toBeVisible();
  });

  test('2FA 验证流程', async ({ page }) => {
    // 登录
    await page.fill('[name="username"]', 'user_with_2fa');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 等待 2FA 页面
    await expect(page).toHaveURL('/login/2fa');
    
    // 输入验证码
    await page.fill('[name="code"]', '123456');
    await page.click('button[type="submit"]');
    
    // 验证登录成功
    await expect(page).toHaveURL('/console/dashboard');
  });
});
```

#### 2. 渠道管理测试

```typescript
// tests/e2e/console/channels.spec.ts
import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth';

test.describe('渠道管理', () => {
  test.beforeEach(async ({ page }) => {
    // 使用 fixture 登录
    await login(page, { role: 'admin' });
    await page.goto('/console/channels');
  });

  test('显示渠道列表', async ({ page }) => {
    // 等待表格加载
    await expect(page.locator('table')).toBeVisible();
    
    // 验证表头
    await expect(page.locator('th:has-text("名称")')).toBeVisible();
    await expect(page.locator('th:has-text("类型")')).toBeVisible();
    await expect(page.locator('th:has-text("状态")')).toBeVisible();
  });

  test('创建新渠道', async ({ page }) => {
    // 点击创建按钮
    await page.click('button:has-text("创建渠道")');
    
    // 填写表单
    await page.fill('[name="name"]', 'Test OpenAI Channel');
    await page.selectOption('[name="type"]', 'openai');
    await page.fill('[name="key"]', 'sk-test-key-123456');
    await page.fill('[name="baseUrl"]', 'https://api.openai.com/v1');
    
    // 提交表单
    await page.click('button[type="submit"]');
    
    // 验证成功消息
    await expect(page.locator('text=渠道创建成功')).toBeVisible();
    
    // 验证列表中出现新渠道
    await expect(page.locator('td:has-text("Test OpenAI Channel")')).toBeVisible();
  });

  test('编辑渠道', async ({ page }) => {
    // 点击第一个渠道的编辑按钮
    await page.click('tr:first-child button:has-text("编辑")');
    
    // 修改名称
    await page.fill('[name="name"]', 'Updated Channel Name');
    
    // 保存
    await page.click('button:has-text("保存")');
    
    // 验证更新成功
    await expect(page.locator('text=渠道更新成功')).toBeVisible();
    await expect(page.locator('td:has-text("Updated Channel Name")')).toBeVisible();
  });

  test('删除渠道', async ({ page }) => {
    // 点击删除按钮
    await page.click('tr:first-child button:has-text("删除")');
    
    // 确认删除
    await page.click('button:has-text("确认")');
    
    // 验证删除成功
    await expect(page.locator('text=渠道删除成功')).toBeVisible();
  });

  test('测试渠道连接', async ({ page }) => {
    // 点击测试按钮
    await page.click('tr:first-child button:has-text("测试")');
    
    // 等待测试结果
    await expect(page.locator('text=测试成功')).toBeVisible({ timeout: 10000 });
  });

  test('批量操作', async ({ page }) => {
    // 选择多个渠道
    await page.check('tr:nth-child(1) input[type="checkbox"]');
    await page.check('tr:nth-child(2) input[type="checkbox"]');
    
    // 批量启用
    await page.click('button:has-text("批量启用")');
    
    // 验证操作成功
    await expect(page.locator('text=批量操作成功')).toBeVisible();
  });

  test('搜索渠道', async ({ page }) => {
    // 输入搜索关键词
    await page.fill('input[placeholder*="搜索"]', 'OpenAI');
    
    // 等待搜索结果
    await page.waitForTimeout(500);
    
    // 验证搜索结果
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('OpenAI');
  });

  test('筛选渠道状态', async ({ page }) => {
    // 选择状态筛选
    await page.selectOption('select[name="status"]', 'enabled');
    
    // 验证只显示启用的渠道
    const statusCells = page.locator('td:has-text("启用")');
    const count = await statusCells.count();
    expect(count).toBeGreaterThan(0);
  });
});
```

#### 3. 聊天操练场测试

```typescript
// tests/e2e/playground/chat.spec.ts
import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth';

test.describe('聊天操练场', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/playground/chat');
  });

  test('发送消息并接收回复', async ({ page }) => {
    // 选择模型
    await page.selectOption('[name="model"]', 'gpt-3.5-turbo');
    
    // 输入消息
    await page.fill('textarea[placeholder*="输入消息"]', 'Hello, how are you?');
    
    // 发送消息
    await page.click('button:has-text("发送")');
    
    // 验证消息显示
    await expect(page.locator('text=Hello, how are you?')).toBeVisible();
    
    // 等待 AI 回复（流式输出）
    await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 });
  });

  test('调整参数', async ({ page }) => {
    // 打开参数面板
    await page.click('button:has-text("参数")');
    
    // 调整温度
    await page.fill('input[name="temperature"]', '0.8');
    
    // 调整最大 Token
    await page.fill('input[name="maxTokens"]', '2000');
    
    // 验证参数已保存
    await expect(page.locator('input[name="temperature"]')).toHaveValue('0.8');
  });

  test('清空对话', async ({ page }) => {
    // 发送一条消息
    await page.fill('textarea', 'Test message');
    await page.click('button:has-text("发送")');
    
    // 等待消息显示
    await expect(page.locator('text=Test message')).toBeVisible();
    
    // 清空对话
    await page.click('button:has-text("清空")');
    
    // 确认清空
    await page.click('button:has-text("确认")');
    
    // 验证对话已清空
    await expect(page.locator('.message')).toHaveCount(0);
  });

  test('导出对话', async ({ page }) => {
    // 发送消息
    await page.fill('textarea', 'Export test');
    await page.click('button:has-text("发送")');
    
    // 等待回复
    await page.waitForTimeout(2000);
    
    // 点击导出
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("导出")'),
    ]);
    
    // 验证文件名
    expect(download.suggestedFilename()).toMatch(/chat-\d+\.json/);
  });
});
```

### 使用 Fixtures

创建可复用的测试工具：

```typescript
// tests/e2e/fixtures/auth.ts
import { Page } from '@playwright/test';

interface LoginOptions {
  username?: string;
  password?: string;
  role?: 'user' | 'admin' | 'root';
}

export async function login(page: Page, options: LoginOptions = {}) {
  const credentials = {
    user: { username: 'testuser', password: 'password123' },
    admin: { username: 'admin', password: 'admin123' },
    root: { username: 'root', password: 'root123' },
  };

  const { username, password } = options.username && options.password
    ? options
    : credentials[options.role || 'user'];

  await page.goto('/login');
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  
  // 等待登录完成
  await page.waitForURL('/console/dashboard');
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('button:has-text("登出")');
  await page.waitForURL('/login');
}
```

```typescript
// tests/e2e/fixtures/data.ts
export const mockChannel = {
  name: 'Test Channel',
  type: 'openai',
  key: 'sk-test-key',
  baseUrl: 'https://api.openai.com/v1',
  priority: 1,
  weight: 100,
};

export const mockToken = {
  name: 'Test Token',
  quota: 1000000,
  expiredTime: -1,
  models: ['gpt-3.5-turbo', 'gpt-4'],
};

export const mockUser = {
  username: 'testuser',
  password: 'password123',
  displayName: 'Test User',
  role: 1,
  quota: 1000000,
};
```

## 🎯 MCP 工具使用

### 可用的 MCP 工具

通过 Playwright MCP 服务器，可以使用以下工具：

#### 1. 浏览器导航
```typescript
// 导航到 URL
await mcp12_browser_navigate({ url: 'http://localhost:5173/login' });

// 后退
await mcp12_browser_navigate_back();
```

#### 2. 元素交互
```typescript
// 点击元素
await mcp12_browser_click({
  element: 'Login button',
  ref: 'button[type="submit"]'
});

// 输入文本
await mcp12_browser_type({
  element: 'Username input',
  ref: 'input[name="username"]',
  text: 'testuser'
});

// 悬停
await mcp12_browser_hover({
  element: 'User menu',
  ref: '[data-testid="user-menu"]'
});
```

#### 3. 表单操作
```typescript
// 填写表单
await mcp12_browser_fill_form({
  fields: [
    {
      name: 'Username',
      type: 'textbox',
      ref: 'input[name="username"]',
      value: 'testuser'
    },
    {
      name: 'Password',
      type: 'textbox',
      ref: 'input[name="password"]',
      value: 'password123'
    },
    {
      name: 'Remember me',
      type: 'checkbox',
      ref: 'input[name="remember"]',
      value: 'true'
    }
  ]
});
```

#### 4. 截图和快照
```typescript
// 截图
await mcp12_browser_take_screenshot({
  filename: 'login-page.png',
  fullPage: true
});

// 可访问性快照
await mcp12_browser_snapshot({
  filename: 'login-snapshot.md'
});
```

#### 5. 等待和验证
```typescript
// 等待文本出现
await mcp12_browser_wait_for({
  text: '登录成功'
});

// 等待文本消失
await mcp12_browser_wait_for({
  textGone: '加载中...'
});

// 等待指定时间
await mcp12_browser_wait_for({
  time: 2
});
```

#### 6. 网络监控
```typescript
// 获取网络请求
const requests = await mcp12_browser_network_requests({
  includeStatic: false
});

// 获取控制台消息
const messages = await mcp12_browser_console_messages({
  level: 'error'
});
```

## 📊 测试报告

### HTML 报告

运行测试后自动生成 HTML 报告：

```bash
npm run test:e2e
npx playwright show-report
```

### 自定义报告

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
});
```

## 🔍 调试技巧

### 1. UI 模式

```bash
npx playwright test --ui
```

### 2. 调试模式

```bash
npx playwright test --debug
```

### 3. 追踪查看器

```bash
npx playwright show-trace trace.zip
```

### 4. 代码生成器

```bash
npx playwright codegen http://localhost:5173
```

## 🚀 CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
        
      - name: Run Playwright tests
        run: npm run test:e2e
        
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## 📝 最佳实践

### 1. 使用数据测试 ID

```tsx
// 组件中
<button data-testid="submit-button">提交</button>

// 测试中
await page.click('[data-testid="submit-button"]');
```

### 2. 避免硬编码等待

```typescript
// ❌ 不好
await page.waitForTimeout(5000);

// ✅ 好
await page.waitForSelector('text=加载完成');
```

### 3. 使用 Page Object Model

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.page.fill('[name="username"]', username);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }

  async getErrorMessage() {
    return this.page.locator('.error-message').textContent();
  }
}

// 使用
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('user', 'pass');
```

### 4. 并行测试

```typescript
test.describe.configure({ mode: 'parallel' });

test.describe('渠道管理', () => {
  test('测试1', async ({ page }) => { /* ... */ });
  test('测试2', async ({ page }) => { /* ... */ });
  test('测试3', async ({ page }) => { /* ... */ });
});
```

### 5. 测试隔离

```typescript
test.beforeEach(async ({ page }) => {
  // 清理状态
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

## 📚 参考资源

- [Playwright 官方文档](https://playwright.dev)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
- [测试最佳实践](https://playwright.dev/docs/best-practices)
- [CI/CD 集成](https://playwright.dev/docs/ci)
