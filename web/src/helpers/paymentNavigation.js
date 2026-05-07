function normalizeUserAgent(userAgent) {
  return typeof userAgent === 'string' ? userAgent : '';
}

export function isMobileLikeUserAgent(userAgent) {
  const ua = normalizeUserAgent(userAgent);
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS/i.test(ua);
}

export function isSafariBrowser(userAgent) {
  const ua = normalizeUserAgent(userAgent);
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/i.test(ua);
}

export function shouldUseSameTabPaymentRedirect(userAgent) {
  return isMobileLikeUserAgent(userAgent);
}

export function redirectToPaymentUrl(url, userAgent = navigator?.userAgent) {
  if (!url || typeof window === 'undefined') {
    return false;
  }

  if (shouldUseSameTabPaymentRedirect(userAgent)) {
    window.location.assign(url);
    return true;
  }

  window.open(url, '_blank');
  return true;
}
