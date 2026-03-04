/**
 * Order Status Verification Helpers
 *
 * Provides functions to poll the backend admin API and verify
 * that topup and subscription orders reach SUCCESS status.
 *
 * Uses shared admin session (admin-session.ts) to minimize login API calls
 * and avoid CriticalRateLimit exhaustion (20 req / 20 min).
 *
 * Backend status values (from common/constants.go):
 *   - TopUpStatusPending = "pending"
 *   - TopUpStatusSuccess = "success"
 *   - TopUpStatusExpired = "expired"
 *
 * Note: Subscription orders also create a corresponding TopUp record
 * with the same trade_no (via model.upsertSubscriptionTopUpTx), so both
 * topup and subscription orders can be verified through the topup list API.
 */

import { getAdminCookie, ADMIN_USER_ID } from './admin-session';

const TOPUP_STATUS_SUCCESS = 'success';

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 120_000;

// ==================== Internal Helpers ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch paginated topup list from the admin API.
 *
 * GET /api/user/topup?p=1&page_size=100
 */
async function fetchTopupList(
  baseUrl: string,
  cookie: string
): Promise<{ trade_no: string; status: string }[]> {
  const url = `${baseUrl}/api/user/topup?p=1&page_size=100`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Cookie: cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
  });

  if (response.status === 429) {
    console.log('[order-verify] Rate limited on topup list fetch, returning empty');
    return [];
  }

  const bodyText = await response.text();
  if (!bodyText) {
    console.log('[order-verify] Empty response body from topup list');
    return [];
  }

  const body = JSON.parse(bodyText);
  if (!body.success) {
    console.log(`[order-verify] Failed to fetch topup list: ${body.message || JSON.stringify(body)}`);
    return [];
  }

  return body.data?.items ?? [];
}

// ==================== Exported Functions ====================

/**
 * Wait for a topup order to reach SUCCESS status by polling the admin API.
 *
 * @param baseUrl - Backend API base URL (e.g. http://localhost:3000)
 * @param orderId - The trade_no of the topup order to check
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 120000)
 * @returns true if the order reached SUCCESS status, false on timeout
 */
export async function waitForTopupOrderSuccess(
  baseUrl: string,
  orderId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<boolean> {
  console.log(`[order-verify] Waiting for topup order SUCCESS: orderId=${orderId}, timeout=${timeoutMs}ms`);

  const cookie = await getAdminCookie(baseUrl);
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempt++;
    const elapsed = Date.now() - startTime;

    const orders = await fetchTopupList(baseUrl, cookie);
    const matchingOrder = orders.find(
      (o) => o.trade_no === orderId
    );

    if (matchingOrder) {
      console.log(
        `[order-verify] Topup poll #${attempt} (${elapsed}ms): found order, status="${matchingOrder.status}"`
      );

      if (matchingOrder.status === TOPUP_STATUS_SUCCESS) {
        console.log(`[order-verify] Topup order SUCCESS: orderId=${orderId}`);
        return true;
      }
    } else {
      console.log(
        `[order-verify] Topup poll #${attempt} (${elapsed}ms): order not found yet (total orders: ${orders.length})`
      );
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  console.log(`[order-verify] Topup order TIMEOUT after ${timeoutMs}ms: orderId=${orderId}`);
  return false;
}

/**
 * Wait for a subscription order to reach SUCCESS status by polling the admin API.
 *
 * Subscription orders create a corresponding TopUp record with the same trade_no
 * (via model.upsertSubscriptionTopUpTx in the backend), so this function uses
 * the same topup list API (GET /api/user/topup) to verify subscription order completion.
 *
 * @param baseUrl - Backend API base URL (e.g. http://localhost:3000)
 * @param orderId - The trade_no of the subscription order to check
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 120000)
 * @returns true if the order reached SUCCESS status, false on timeout
 */
export async function waitForSubscriptionOrderSuccess(
  baseUrl: string,
  orderId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<boolean> {
  console.log(`[order-verify] Waiting for subscription order SUCCESS: orderId=${orderId}, timeout=${timeoutMs}ms`);

  const cookie = await getAdminCookie(baseUrl);
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempt++;
    const elapsed = Date.now() - startTime;

    // Subscription orders are also recorded in the topup table with the same trade_no
    const orders = await fetchTopupList(baseUrl, cookie);
    const matchingOrder = orders.find(
      (o) => o.trade_no === orderId
    );

    if (matchingOrder) {
      console.log(
        `[order-verify] Subscription poll #${attempt} (${elapsed}ms): found order, status="${matchingOrder.status}"`
      );

      if (matchingOrder.status === TOPUP_STATUS_SUCCESS) {
        console.log(`[order-verify] Subscription order SUCCESS: orderId=${orderId}`);
        return true;
      }
    } else {
      console.log(
        `[order-verify] Subscription poll #${attempt} (${elapsed}ms): order not found yet (total orders: ${orders.length})`
      );
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  console.log(`[order-verify] Subscription order TIMEOUT after ${timeoutMs}ms: orderId=${orderId}`);
  return false;
}
