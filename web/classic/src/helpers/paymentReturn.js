export const PAYMENT_RETURN_STORAGE_KEY = 'wallet_payment_return';

export function isPaymentReturnStatus(value) {
  return value === 'success' || value === 'pending' || value === 'fail';
}

export function isPaymentReturnScope(value) {
  return value === 'topup' || value === 'subscription';
}

export function markPaymentFlowStart(scope, source) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PAYMENT_RETURN_STORAGE_KEY,
      JSON.stringify({
        scope,
        source,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // ignore
  }
}

export function completePaymentReturnMarker(scope, status) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PAYMENT_RETURN_STORAGE_KEY,
      JSON.stringify({
        scope,
        source: 'same_tab',
        status,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // ignore
  }
}

export function readPaymentReturnMarker() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PAYMENT_RETURN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPaymentReturnScope(parsed?.scope)) return null;
    if (typeof parsed?.createdAt !== 'number') return null;
    if (
      parsed?.status !== undefined &&
      !isPaymentReturnStatus(parsed.status)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPaymentReturnMarker() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasRecentPaymentMarker(marker, maxAgeMs = 10 * 60 * 1000) {
  if (!marker || typeof marker.createdAt !== 'number') return false;
  const now = Date.now();
  return now - marker.createdAt >= 0 && now - marker.createdAt <= maxAgeMs;
}
