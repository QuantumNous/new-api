function getLocalStorageValue(key) {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

function getStatusFromStorage() {
  const statusStr = getLocalStorageValue('status');
  if (!statusStr) {
    return {};
  }
  try {
    return JSON.parse(statusStr) || {};
  } catch {
    return {};
  }
}

function getPositiveNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

export function formatPaymentAmount(amount, options = {}) {
  const t = options.t || ((key) => key);
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const quotaDisplayType =
    options.quotaDisplayType ||
    getLocalStorageValue('quota_display_type') ||
    'USD';
  const status = options.status || getStatusFromStorage();
  const usdExchangeRate = getPositiveNumber(status?.usd_exchange_rate, 7);

  if (quotaDisplayType === 'USD') {
    return `${(safeAmount / usdExchangeRate).toFixed(2)} USD`;
  }

  if (quotaDisplayType === 'CUSTOM') {
    const symbol = status?.custom_currency_symbol || '¤';
    const customRate = getPositiveNumber(
      status?.custom_currency_exchange_rate,
      1,
    );
    return `${symbol}${((safeAmount / usdExchangeRate) * customRate).toFixed(
      2,
    )}`;
  }

  return `${safeAmount.toFixed(2)} ${t('元')}`;
}
