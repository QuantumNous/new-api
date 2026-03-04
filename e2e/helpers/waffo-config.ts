/**
 * Waffo configuration helper for E2E tests.
 *
 * Manages WaffoNotifyUrl and WaffoReturnUrl options through the admin API,
 * enabling dynamic webhook URL configuration when using cloudflared tunnels.
 *
 * Uses shared admin session (admin-session.ts) to minimize login API calls
 * and avoid CriticalRateLimit exhaustion (20 req / 20 min).
 */

import { getAdminCookie, ADMIN_USER_ID } from './admin-session';

/**
 * Update a single option via PUT /api/option/.
 */
async function updateOption(
  baseUrl: string,
  cookie: string,
  key: string,
  value: string
): Promise<void> {
  console.log(`[waffo-config] Updating option: ${key} = "${value}"`);

  const response = await fetch(`${baseUrl}/api/option/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
    body: JSON.stringify({ key, value }),
  });

  const body = await response.json();

  if (!body.success) {
    throw new Error(
      `[waffo-config] Failed to update ${key}: ${body.message || JSON.stringify(body)}`
    );
  }

  console.log(`[waffo-config] Successfully updated ${key}`);
}

/**
 * Update WaffoNotifyUrl and WaffoReturnUrl to point to the cloudflared tunnel.
 *
 * - WaffoNotifyUrl = tunnelUrl + "/api/waffo/webhook"
 * - WaffoReturnUrl = tunnelUrl + "/console/topup"
 *
 * @param baseUrl - Backend API base URL (e.g. http://localhost:3000)
 * @param tunnelUrl - Public tunnel URL (e.g. https://xxx.trycloudflare.com)
 */
export async function updateWaffoCallbackUrls(
  baseUrl: string,
  tunnelUrl: string
): Promise<void> {
  console.log(`[waffo-config] Updating Waffo callback URLs to tunnel: ${tunnelUrl}`);

  const cookie = await getAdminCookie(baseUrl);

  const notifyUrl = `${tunnelUrl}/api/waffo/webhook`;
  const returnUrl = `${tunnelUrl}/console/topup`;

  await updateOption(baseUrl, cookie, 'WaffoNotifyUrl', notifyUrl);
  await updateOption(baseUrl, cookie, 'WaffoReturnUrl', returnUrl);

  console.log('[waffo-config] Waffo callback URLs updated successfully:');
  console.log(`[waffo-config]   WaffoNotifyUrl = ${notifyUrl}`);
  console.log(`[waffo-config]   WaffoReturnUrl = ${returnUrl}`);
}

/**
 * Restore WaffoNotifyUrl and WaffoReturnUrl to empty strings (default values).
 *
 * @param baseUrl - Backend API base URL (e.g. http://localhost:3000)
 */
export async function restoreWaffoCallbackUrls(
  baseUrl: string
): Promise<void> {
  console.log('[waffo-config] Restoring Waffo callback URLs to defaults (empty)...');

  const cookie = await getAdminCookie(baseUrl);

  await updateOption(baseUrl, cookie, 'WaffoNotifyUrl', '');
  await updateOption(baseUrl, cookie, 'WaffoReturnUrl', '');

  console.log('[waffo-config] Waffo callback URLs restored to defaults');
}
