/**
 * Playwright global setup for payment flow E2E tests.
 *
 * Starts a single cloudflared tunnel and configures Waffo callback URLs.
 * The tunnel URL is shared with test files via process.env.TUNNEL_URL.
 *
 * This runs once before ALL test files, ensuring a single tunnel is reused
 * across both topup and subscription flow specs (avoids rapid tunnel
 * teardown/creation which causes Cloudflare forwarding failures).
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { startTunnel } from './helpers/tunnel';
import { updateWaffoCallbackUrls } from './helpers/waffo-config';

const BACKEND_BASE_URL = 'http://localhost:3000';
const BACKEND_PORT = 3000;
const AUTH_STATE_FILE = path.join(__dirname, '.auth-state.json');

/**
 * 在 global-setup 里统一预建 auth 缓存，解决并行 worker 竞态写文件的问题。
 *
 * 并发问题根因：4 个 worker 同时启动，各自发现 .auth-state.json 不存在，
 * 全部执行完整登录流程，并发写同一个文件 → 某些 worker 读到写入中的脏文件 → 白屏。
 *
 * 修复：global-setup 跑在所有 worker 之前，只登录一次，写完缓存文件后
 * workers 才启动，各自只做只读，不再竞争写。
 */
async function preCreateAuthState(): Promise<void> {
  // 总是重新登录：后端重启后旧 session cookie 失效，缓存不可复用。
  // global-setup 只跑一次，写完后 workers 只读，不再竞争写文件。
  console.log('[global-setup] Pre-creating auth state for parallel workers...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();

  await page.goto(`${BACKEND_BASE_URL}/login`, { waitUntil: 'load' });
  await page.getByPlaceholder(/请输入您的用户名|Please enter your username/i).fill('admin');
  await page.getByPlaceholder(/请输入您的密码|Please enter your password/i).fill('admin123456');
  await page.getByRole('button', { name: /继续|Continue/i }).click();
  await page.waitForURL(/\/console/, { timeout: 30000 });
  await page.waitForLoadState('load');

  const state = await context.storageState();
  fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state));

  await browser.close();
  console.log('[global-setup] Auth state saved to', AUTH_STATE_FILE);
}

async function globalSetup() {
  console.log('[global-setup] Starting tunnel and configuring Waffo callbacks...');

  // 允许通过环境变量传入已有隧道，跳过 cloudflared 启动（避免频繁建隧道被限流）
  let tunnelUrl: string;
  if (process.env.TUNNEL_URL) {
    tunnelUrl = process.env.TUNNEL_URL;
    console.log(`[global-setup] Using existing tunnel from env: ${tunnelUrl}`);
  } else {
    tunnelUrl = await startTunnel(BACKEND_PORT);
    process.env.TUNNEL_URL = tunnelUrl;
  }

  await updateWaffoCallbackUrls(BACKEND_BASE_URL, tunnelUrl);

  // 预建 auth 缓存，消除并行 worker 竞态写文件问题
  await preCreateAuthState();

  console.log(`[global-setup] Ready. Tunnel: ${tunnelUrl}`);
}

export default globalSetup;
