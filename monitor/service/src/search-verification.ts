import crypto from 'node:crypto';
import { CacheClient } from './cache.js';
import { config } from './config.js';

const SEARCH_ACCESS_PREFIX = 'search-access:';
const GEETEST_VALIDATE_URL = 'https://gcaptcha4.geetest.com/validate';

export interface GeetestValidationPayload {
  lotNumber: string;
  captchaOutput: string;
  passToken: string;
  genTime: string;
}

interface GeetestValidationResponse {
  status?: string;
  result?: string;
  reason?: string;
  msg?: string;
}

export function isSearchVerificationEnabled(): boolean {
  return Boolean(config.geetestCaptchaId && config.geetestCaptchaKey);
}

export async function verifyGeetestCaptcha(payload: GeetestValidationPayload): Promise<{
  success: boolean;
  reason: string;
}> {
  if (!isSearchVerificationEnabled()) {
    return {
      success: false,
      reason: 'Search verification is not configured',
    };
  }

  const signToken = crypto
    .createHmac('sha256', config.geetestCaptchaKey)
    .update(payload.lotNumber)
    .digest('hex');

  const body = new URLSearchParams({
    lot_number: payload.lotNumber,
    captcha_output: payload.captchaOutput,
    pass_token: payload.passToken,
    gen_time: payload.genTime,
    sign_token: signToken,
  });

  try {
    const response = await fetch(`${GEETEST_VALIDATE_URL}?captcha_id=${encodeURIComponent(config.geetestCaptchaId)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      return {
        success: false,
        reason: `Geetest validate request failed (${response.status})`,
      };
    }

    const data = await response.json() as GeetestValidationResponse;
    if (data.status === 'success' && data.result === 'success') {
      return {
        success: true,
        reason: '',
      };
    }

    return {
      success: false,
      reason: data.reason || data.msg || 'Captcha validation failed',
    };
  } catch (_error) {
    return {
      success: false,
      reason: 'Captcha verification request failed',
    };
  }
}

export function buildSearchTarget(scope: 'key' | 'channel' | 'user', value: string): string {
  return `${scope}:${value.trim()}`;
}

export async function createSearchAccessToken(cache: CacheClient, searchTarget: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex');
  await cache.setPersistent(`${SEARCH_ACCESS_PREFIX}${token}`, searchTarget);
  return token;
}

export async function hasSearchAccessToken(cache: CacheClient, token: string, searchTarget: string): Promise<boolean> {
  if (!token.trim()) {
    return false;
  }

  const cachedTarget = await cache.get<string>(`${SEARCH_ACCESS_PREFIX}${token.trim()}`);
  return cachedTarget === searchTarget;
}

export async function revokeSearchAccessToken(cache: CacheClient, token: string): Promise<void> {
  if (!token.trim()) {
    return;
  }

  await cache.delete(`${SEARCH_ACCESS_PREFIX}${token.trim()}`);
}
