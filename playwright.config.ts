import { defineConfig, devices } from '@playwright/test';

/**
 * New API - E2E Test Configuration
 *
 * 测试 Waffo 支付集成的端到端回归测试
 */
export default defineConfig({
  testDir: './e2e/tests',

  /* 最大失败次数 */
  maxFailures: 20,

  /* 并行执行的 worker 数量 */
  workers: 1,

  /* 测试超时时间 */
  timeout: 60_000,
  expect: {
    timeout: 10 * 1000,
  },

  /* 失败时重试次数 */
  retries: 1,

  /* 报告配置 */
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
    ['json', { outputFile: 'e2e-results.json' }]
  ],

  /* 全局配置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:5173',

    /* 截图配置 */
    screenshot: 'only-on-failure',

    /* 视频配置 */
    video: 'retain-on-failure',

    /* Trace 配置 */
    trace: 'on-first-retry',

    /* 浏览器上下文选项 */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    /* 导航超时 */
    navigationTimeout: 30 * 1000,

    /* 浏览器语言设置为中文 */
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },

  /* 全局 setup/teardown：为支付流程测试启动 cloudflared 隧道 */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  /* 测试项目配置 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 开发服务器配置 */
  webServer: {
    command: 'cd web && bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
