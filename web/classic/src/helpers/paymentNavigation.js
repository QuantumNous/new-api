/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
function normalizeUserAgent(userAgent) {
  return typeof userAgent === 'string' ? userAgent : '';
}

export function isMobileLikeUserAgent(userAgent) {
  const ua = normalizeUserAgent(userAgent);
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS/i.test(ua);
}

export function isSafariBrowser(userAgent) {
  const ua = normalizeUserAgent(userAgent);
  return (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/i.test(ua)
  );
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
