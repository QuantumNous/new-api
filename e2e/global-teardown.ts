/**
 * Playwright global teardown for payment flow E2E tests.
 *
 * Restores Waffo callback URLs to defaults and stops the cloudflared tunnel.
 */

import { stopTunnel } from './helpers/tunnel';
import { restoreWaffoCallbackUrls } from './helpers/waffo-config';

const BACKEND_BASE_URL = 'http://localhost:3000';

async function globalTeardown() {
  console.log('[global-teardown] Cleaning up...');

  try {
    await restoreWaffoCallbackUrls(BACKEND_BASE_URL);
    console.log('[global-teardown] Waffo callback URLs restored');
  } catch (err) {
    console.log(`[global-teardown] Warning: Failed to restore callback URLs: ${err}`);
  }

  try {
    stopTunnel();
    console.log('[global-teardown] Tunnel stopped');
  } catch (err) {
    console.log(`[global-teardown] Warning: Failed to stop tunnel: ${err}`);
  }
}

export default globalTeardown;
