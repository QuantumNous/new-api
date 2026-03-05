import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 e2e/.env（关闭限流等测试专用配置），不影响根目录 .env
dotenv.config({ path: path.join(__dirname, 'e2e', '.env') });

/**
 * New API - E2E Test Configuration
 *
 * 测试 Waffo 支付集成的端到端回归测试
 *
 * ── 关键设计决策 ──────────────────────────────────────────────────────────
 *
 * [baseURL = :3000]
 *   使用 Go 内嵌的 build 前端，而非 bun dev server (:5173)。
 *   原因：bun dev 使用 unbundled ESM，冷启动时每个模块单独请求，
 *   设置页面首次加载需 20-30s；build 版本只有一个 bundle，加载 1-3s。
 *   注意：前端有任何改动需先 `bun run build` 再重启后端。
 *
 * [workers = 4]
 *   测试文件级并行。不同文件的测试同时跑。
 *   例外：修改真实 DB 的文件（waffo-pay-methods-config, waffo-settings）
 *   需在文件顶部加 `test.describe.configure({ mode: 'serial' })` 防止数据竞争。
 *
 * [timeout = 60s, expect.timeout = 10s]
 *   本地接口毫秒级，单个断言 10s 上限足够。
 *   需多次页面跳转（登录→设置页→操作）的测试用 test.slow() 获得 3× 预算。
 *
 * [waitUntil 策略]
 *   本地页面（/console/*、/login）统一用 'load'，不用 'networkidle'。
 *   原因：充值页/订阅页有后台轮询，网络永远不会 idle，导致 goto 无限等待。
 *   外部 Waffo sandbox 页面可用 'networkidle'（轮询量少，通常能稳定）。
 *
 * [page.route() mock 范围]
 *   拦截 API 时 pattern 要精确：'*\/api\/user\/topup\?*' 而非 '*\/topup*'。
 *   宽泛的 glob 会同时拦截 /topup/info 等子路径，导致前端收到意外响应而白屏。
 *   优先使用 regex：/\/api\/user\/topup(\?|$)/ 明确排除子路径。
 *
 * ── 运行命令 ────────────────────────────────────────────────────────────
 *   全量运行：  TUNNEL_URL=https://xxx.trycloudflare.com npx playwright test
 *   仅失败项：  npx playwright test --last-failed
 *   单文件：    npx playwright test e2e/tests/waffo-refund-flow.spec.ts
 * ────────────────────────────────────────────────────────────────────────
 */
export default defineConfig({
  testDir: './e2e/tests',

  /* 最大失败次数 */
  maxFailures: 20,

  /* 并行执行的 worker 数量 */
  workers: 4,

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
    /* 基础 URL：使用 Go 内嵌的 build 版本，比 bun dev 快 10-20x */
    baseURL: 'http://localhost:3000',

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

  /* 开发服务器配置：复用已运行的 Go 后端（内嵌 build 前端） */
  webServer: {
    command: 'go run main.go',
    url: 'http://localhost:3000',
    // 将 e2e/.env 中的限流开关注入到 server 进程（未启动时自动带上；已启动则需手动重启）
    env: {
      GLOBAL_WEB_RATE_LIMIT_ENABLE: process.env.GLOBAL_WEB_RATE_LIMIT_ENABLE ?? 'false',
      GLOBAL_API_RATE_LIMIT_ENABLE: process.env.GLOBAL_API_RATE_LIMIT_ENABLE ?? 'false',
      CRITICAL_RATE_LIMIT_ENABLE: process.env.CRITICAL_RATE_LIMIT_ENABLE ?? 'false',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
