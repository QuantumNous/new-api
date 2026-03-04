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

import { startTunnel } from './helpers/tunnel';
import { updateWaffoCallbackUrls } from './helpers/waffo-config';

const BACKEND_BASE_URL = 'http://localhost:3000';
const BACKEND_PORT = 3000;

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

  console.log(`[global-setup] Ready. Tunnel: ${tunnelUrl}`);
}

export default globalSetup;
