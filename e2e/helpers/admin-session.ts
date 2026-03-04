/**
 * Shared Admin Session Manager
 *
 * Caches the admin login cookie to avoid redundant login API calls
 * across helpers (waffo-config, order-verify). This is critical because
 * the login endpoint uses CriticalRateLimit (20 requests per 20 minutes),
 * shared across ALL critical endpoints from the same IP.
 *
 * Usage: import { getAdminCookie } from './admin-session';
 */

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/** Cached cookie string, shared across all helpers in the same process */
let cachedCookie: string | null = null;
let cacheTimestamp = 0;

/** Cookie cache TTL: 10 minutes (server session is typically longer) */
const CACHE_TTL_MS = 10 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get an admin session cookie, reusing cached value when possible.
 *
 * @param baseUrl - Backend API base URL (e.g. http://localhost:3000)
 * @param forceRefresh - Force a new login even if cache is valid
 * @returns Session cookie string for use in Cookie header
 */
export async function getAdminCookie(
  baseUrl: string,
  forceRefresh = false
): Promise<string> {
  // Return cached cookie if still valid
  if (
    !forceRefresh &&
    cachedCookie &&
    Date.now() - cacheTimestamp < CACHE_TTL_MS
  ) {
    console.log('[admin-session] Using cached admin cookie');
    return cachedCookie;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(
      `[admin-session] Logging in as ${ADMIN_USERNAME} at ${baseUrl}... (attempt ${attempt}/${MAX_RETRIES})`
    );

    const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
      redirect: 'manual',
    });

    // Handle rate limiting (429 returns empty body)
    if (loginResponse.status === 429) {
      console.log(
        `[admin-session] Rate limited (429). Waiting ${RETRY_DELAY_MS}ms before retry...`
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error(
        '[admin-session] Login failed: rate limited (429) after all retries'
      );
    }

    // Read response body once
    const bodyText = await loginResponse.text();
    if (!bodyText) {
      console.log(
        `[admin-session] Empty response body (status: ${loginResponse.status}). Retrying...`
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error(
        `[admin-session] Login failed: empty response after all retries (status: ${loginResponse.status})`
      );
    }

    const loginBody = JSON.parse(bodyText);

    if (!loginBody.success) {
      throw new Error(
        `[admin-session] Login failed: ${loginBody.message || JSON.stringify(loginBody)}`
      );
    }

    // Extract session cookie from Set-Cookie header
    const setCookieHeader =
      loginResponse.headers.getSetCookie?.() ?? [
        loginResponse.headers.get('set-cookie') ?? '',
      ];

    const cookies = setCookieHeader
      .filter((c) => c.length > 0)
      .map((c) => c.split(';')[0])
      .join('; ');

    if (!cookies) {
      throw new Error(
        `[admin-session] Login succeeded but no session cookie received. Status: ${loginResponse.status}`
      );
    }

    // Cache the cookie
    cachedCookie = cookies;
    cacheTimestamp = Date.now();
    console.log('[admin-session] Login successful, cookie cached');
    return cookies;
  }

  throw new Error('[admin-session] Login failed: exhausted all retries');
}

/** Clear the cached cookie (use in afterAll cleanup) */
export function clearAdminSession(): void {
  cachedCookie = null;
  cacheTimestamp = 0;
  console.log('[admin-session] Cookie cache cleared');
}

/** Admin user ID constant for New-Api-User header */
export const ADMIN_USER_ID = '1';
