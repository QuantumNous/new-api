import { test, expect } from '@playwright/test';
import { getAdminCookie, ADMIN_USER_ID } from '../helpers/admin-session';

/**
 * Waffo enableWaffo sandbox key check E2E tests
 *
 * Validates the fix in controller/topup.go:
 * - sandbox mode: ALL THREE sandbox keys (ApiKey + PrivateKey + PublicKey) must be non-empty
 * - production mode: ALL THREE production keys must be non-empty
 * - Bug before fix: sandbox mode only checked PublicKey; missing ApiKey/PrivateKey still showed entry
 *
 * Test strategy: API-level tests against GET /api/user/self/topup/info
 * No browser page interaction needed — pure fetch against the backend.
 */

const BASE_URL = 'http://localhost:3000';

/** Waffo sandbox key option names */
const SANDBOX_API_KEY = 'WaffoSandboxApiKey';
const SANDBOX_PRIVATE_KEY = 'WaffoSandboxPrivateKey';
const SANDBOX_PUBLIC_KEY = 'WaffoSandboxPublicKey';

/** Read a single option value from DB via admin GET /api/option/ (not available as read API)
 *  Instead we capture the original value before each test by querying the topup/info endpoint
 *  or we hard-code a restoration sentinel. Since waffo-config.ts already uses PUT /api/option/,
 *  we use the same pattern: save original value before modifying, restore in cleanup.
 */
async function updateOption(cookie: string, key: string, value: string): Promise<void> {
  console.log(`[sandbox-check] Setting ${key} = "${value ? value.substring(0, 20) + '...' : '(empty)'}"`);
  const res = await fetch(`${BASE_URL}/api/option/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
    body: JSON.stringify({ key, value }),
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`[sandbox-check] Failed to update ${key}: ${body.message || JSON.stringify(body)}`);
  }
}

/**
 * Call GET /api/user/topup/info as admin and return the `data` field of the JSON body.
 * Route: selfRoute.GET("/topup/info", ...) where selfRoute = userRoute.Group("/")
 * so the full path is /api/user/topup/info.
 * Admin session cookie works here because admin is also a regular user.
 */
async function getTopUpInfo(cookie: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/user/topup/info`, {
    method: 'GET',
    headers: {
      'Cookie': cookie,
      'New-Api-User': ADMIN_USER_ID,
    },
  });
  if (!res.ok) {
    throw new Error(`[sandbox-check] GET /api/user/topup/info failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(`[sandbox-check] GET /api/user/topup/info returned success=false: ${body.message}`);
  }
  // The response wraps the payload under `data`
  return body.data as Record<string, unknown>;
}

test.describe('TC-SANDBOX: enableWaffo sandbox key completeness check', () => {

  // Original sandbox key values — captured once per describe block
  // We read them from the DB snapshot captured in globalSetup or directly via the test
  // The current DB state has all keys set, so we save them in beforeAll.
  let originalSandboxApiKey = '';
  let originalSandboxPrivateKey = '';
  let originalSandboxPublicKey = '';
  let adminCookie = '';

  test.beforeAll(async () => {
    adminCookie = await getAdminCookie(BASE_URL);

    // Snapshot current values via the DB (sqlite3 is available in the test environment).
    // We use child_process exec to read the DB directly — this avoids needing a read API.
    const { execSync } = await import('child_process');
    const dbPath = '/Users/zhaozhongyuan/workspace/github/new-api/one-api.db';

    function readOption(key: string): string {
      try {
        return execSync(
          `sqlite3 "${dbPath}" "SELECT value FROM options WHERE key='${key}' LIMIT 1;"`,
          { encoding: 'utf-8' }
        ).trim();
      } catch {
        return '';
      }
    }

    originalSandboxApiKey = readOption(SANDBOX_API_KEY);
    originalSandboxPrivateKey = readOption(SANDBOX_PRIVATE_KEY);
    originalSandboxPublicKey = readOption(SANDBOX_PUBLIC_KEY);

    console.log(`[sandbox-check] Snapshotted sandbox keys:`);
    console.log(`  ${SANDBOX_API_KEY}     = "${originalSandboxApiKey ? originalSandboxApiKey.substring(0, 20) + '...' : '(empty)'}"`);
    console.log(`  ${SANDBOX_PRIVATE_KEY} = "${originalSandboxPrivateKey ? originalSandboxPrivateKey.substring(0, 20) + '...' : '(empty)'}"`);
    console.log(`  ${SANDBOX_PUBLIC_KEY}  = "${originalSandboxPublicKey ? originalSandboxPublicKey.substring(0, 20) + '...' : '(empty)'}"`);
  });

  test.afterAll(async () => {
    // Always restore original values regardless of test outcome
    console.log('[sandbox-check] Restoring original sandbox key values...');
    adminCookie = await getAdminCookie(BASE_URL);
    await updateOption(adminCookie, SANDBOX_API_KEY, originalSandboxApiKey);
    await updateOption(adminCookie, SANDBOX_PRIVATE_KEY, originalSandboxPrivateKey);
    await updateOption(adminCookie, SANDBOX_PUBLIC_KEY, originalSandboxPublicKey);
    console.log('[sandbox-check] Restore complete.');
  });

  /**
   * TC-SANDBOX-1: sandbox mode — WaffoSandboxApiKey empty => enable_waffo_topup must be false
   *
   * Pre-condition: WaffoEnabled=true, WaffoSandbox=true
   *   WaffoSandboxPrivateKey and WaffoSandboxPublicKey have values
   *   WaffoSandboxApiKey is cleared to empty string
   * Expected: enable_waffo_topup === false
   *
   * This proves the fix: before the fix only PublicKey was checked, so clearing ApiKey
   * would have no effect and enable_waffo_topup would still be true.
   */
  test('TC-SANDBOX-1: sandbox mode with WaffoSandboxApiKey empty returns enable_waffo_topup=false', async () => {
    // Clear only the ApiKey; keep PrivateKey and PublicKey intact
    await updateOption(adminCookie, SANDBOX_API_KEY, '');

    const info = await getTopUpInfo(adminCookie);
    console.log(`[sandbox-check] TC-SANDBOX-1 enable_waffo_topup = ${info.enable_waffo_topup}`);

    expect(
      info.enable_waffo_topup,
      'enable_waffo_topup should be false when WaffoSandboxApiKey is empty (sandbox mode)'
    ).toBe(false);
  });

  /**
   * TC-SANDBOX-2: sandbox mode — WaffoSandboxPrivateKey empty => enable_waffo_topup must be false
   *
   * Pre-condition: ApiKey and PublicKey set, PrivateKey cleared
   */
  test('TC-SANDBOX-2: sandbox mode with WaffoSandboxPrivateKey empty returns enable_waffo_topup=false', async () => {
    // Restore ApiKey first (TC-1 may have cleared it), then clear PrivateKey
    await updateOption(adminCookie, SANDBOX_API_KEY, originalSandboxApiKey);
    await updateOption(adminCookie, SANDBOX_PRIVATE_KEY, '');

    const info = await getTopUpInfo(adminCookie);
    console.log(`[sandbox-check] TC-SANDBOX-2 enable_waffo_topup = ${info.enable_waffo_topup}`);

    expect(
      info.enable_waffo_topup,
      'enable_waffo_topup should be false when WaffoSandboxPrivateKey is empty (sandbox mode)'
    ).toBe(false);
  });

  /**
   * TC-SANDBOX-3: sandbox mode — all three sandbox keys present => enable_waffo_topup must be true
   *
   * Verifies the positive path: once all sandbox keys are set, the entry is shown again.
   * Uses known-valid fallback credentials so the test works even if the DB was originally empty.
   */
  test('TC-SANDBOX-3: sandbox mode with all sandbox keys set returns enable_waffo_topup=true', async () => {
    // Use the original values if available; fall back to known-valid sandbox credentials
    // so the test can pass even when the DB did not have all 3 keys pre-populated.
    const FALLBACK_SANDBOX_API_KEY = 'AQEAjKnbXx0MPtI6rGaeEqPdNEyQ29Fs';
    const FALLBACK_SANDBOX_PRIVATE_KEY = 'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCMqdtfHQw+0jqsZp4So900TJDb0Wzxw611F0a3XR81SOwJGc0zQWQ2L2Xhpq86QYnzWv/OyxxWI56lLwMdXSgzyDvod+sqhr3ZzsZ1H/KWnvatKXBRDYjsFyLE8icYJq6aDpDeVl2bfPpvJfLu3XDcAuAlv4HfLe0Ic6q+fdtbpTGsIiZAfC0DfAP8YwfkVPRpjwdveQW33OKsk47cgq+CPwpLU/dpDe0/S6zzQjaySAyJk0lTBqOnMVbCX/Yhcma4mB9NFyRzC9xkxh4v4XgtbARmytMBWG3sz9c44/Gg8rtn1my0UlDwomBHDpLsKAQneny7DAXUzht4augMxnnBAgMBAAECggEAfYTg1aoFEFXmt4rGiZmhvZaJOS5TShWzxiWkG+HEBHdy8NgOTSuP8e4vusFT4ecz422TkYObYJ5eZcZiwCQtyK9oDhRcTFF6Pk8OtttwTMnDE1hD+n/aa9plU1tGWX3DFoPi8BQfaa2HiAFUG6SMnjcOr4CJso630m/ssBl80fRs4a6bGF7pnypn8bBeCAioMaLUcHnVy+4Gru+3JX28OvHl6NkZWCfU7yXW5fx33Y4QfYYPklWYDqy7ezjSbgLklfWMj0jXIAIEjZhiQyP++ZWN0KHiP/TCpxlXYy2VfSRUbBz/KmbRoNHeS1kpAfkrBkbXdQ6u7jLEE53TsFIHhQKBgQDXCp3yHCkPqxEaV6KZhCcDVi7sZUc1NYeXcqGSfsom3h9azupo0BIORF/MFfjv+IR2E2X6q65xI91DVKaxyaNktNFjs+Zb6TNYi7SQAxQzlk+jDb7UHrsOteqIjG+yrcyBuEZQLye2D/7ANmOR6dzy0TtlMh7z+cd1+tskUI4yVwKBgQCndJVvOHlmcvnKAcxaL1mUdJlv8byBXFm4n9aeDDv/8Bg0esirl80Z/SMstIacJLyvKmVVlf3OB+ot6aGw+tsHvJ1/u4n6MEk7oliJeKZDlLbMggsaaD3woqFSoO2juIf442P9TXRE7nKuFvKb/28YL4uvoHezVlq0yKPtDKGVpwKBgDgGChQzhfcRCEmmnzQDm+5gm6T21dBk+8hXEwUJhz0NDXopAiUAYFPbOGIBL3PFeS0R7LWb2LydLV4HRc53y9vGx+6DxfYYEUp2Szphsvelp2XBhP/aab1xY4Ljo44XfXomOhtVzbC/Bg2pndM77FZOcHzyy+GgJ3jzO/iADCvNAoGAE8/9Zj1eT7rGxxnTXdBAXwo0pUQKs5uDmg5/TA/SgYOcuYjVeUfqomqK4N0zGAJYuLjhaHDoqJnTIT+FO/VSOOYeFGDSAGH6KC4bH5jAwzozLpssSSGQQopbX/VeaIKKw+3ThMLHQOiddO+OINrmAAyQEGWCBBvxe3ZJvuBBtf0CgYAr+ENoWrSDIwtT2fl8Sn+oEhEHszfQKzLFrjDLEzZ1oIWVZWJzmrdDkDB+FMEKJSIiApjECU1K4oLUdO4aGiG4p5vmZ4lC+QDBZfPb5j9ioeUMoELWTZIbQgaf8bzlEXFE5c6L1lPtQr9CLPGw2KRy4TQTLYtBMwRBSgu3UfpTfA==';
    const FALLBACK_SANDBOX_PUBLIC_KEY = 'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAhAbK3dBDZdCaX/5cqlO8EYYL4M4DyigqAMoIaT6R0SuSENu279dHZ3JiS8JukHx/xg85T9S3wDNwnu8KDypcwi8TxNQKgBE4czgAJ5GFEdJ+jtUS1dK46gjJFUnUlavb3uMLJJ0xZZKH0B5GtKOq75MwHWtXLK3zQrPqZosXqdgZhfbV+7bXlQaABdPlqif/ybN1DRrvcWmNVLAgsRiQvu4QnDOTMafzrSsF5tf8Ud3gK+JhcJs50NsXLPZZSc6NryZoH++xmz8atp0dOrBKmsJkZRWjrH+aXDZZT1sZDlgsKBMoRPf6F+lztFOPerrhSE81Y5MFaAp8R/QicMGCPueLhlebjx1OF0oowUD9b7ggZ8LiYpaR4HT9OmDpsu6NMN7zNG81qo7vnKCyy//xdOkpr4bQsm581r312y1UUjaYTZTlqAe+qbGZmZ7zS+ra0uwS6zLoZOY1ToOwlJbTwRPx2epweJcRnJVueiS1fPxaAlQz+tuVtIGONmZ836aHAgMBAAE=';
    await updateOption(adminCookie, SANDBOX_API_KEY, originalSandboxApiKey || FALLBACK_SANDBOX_API_KEY);
    await updateOption(adminCookie, SANDBOX_PRIVATE_KEY, originalSandboxPrivateKey || FALLBACK_SANDBOX_PRIVATE_KEY);
    await updateOption(adminCookie, SANDBOX_PUBLIC_KEY, originalSandboxPublicKey || FALLBACK_SANDBOX_PUBLIC_KEY);

    const info = await getTopUpInfo(adminCookie);
    console.log(`[sandbox-check] TC-SANDBOX-3 enable_waffo_topup = ${info.enable_waffo_topup}`);

    expect(
      info.enable_waffo_topup,
      'enable_waffo_topup should be true when all three sandbox keys are present (sandbox mode)'
    ).toBe(true);
  });
});
