const numberFormatter = new Intl.NumberFormat('zh-CN');

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function readAffiliateRmbQuotaConfig(storage = globalThis.localStorage) {
  const quotaPerUnit = safeNumber(storage?.getItem?.('quota_per_unit'), 1);
  let usdExchangeRate = 1;

  try {
    const status = JSON.parse(storage?.getItem?.('status') || '{}');
    usdExchangeRate = safeNumber(status?.usd_exchange_rate, 1);
  } catch (error) {
    usdExchangeRate = 1;
  }

  return {
    quotaPerUnit: quotaPerUnit > 0 ? quotaPerUnit : 1,
    usdExchangeRate: usdExchangeRate > 0 ? usdExchangeRate : 1,
  };
}

export function formatAffiliateRmbQuota(quota, config = {}) {
  const quotaNumber = safeNumber(quota, 0);
  const quotaPerUnit = safeNumber(config.quotaPerUnit, 1);
  const usdExchangeRate = safeNumber(config.usdExchangeRate, 1);
  const digits = Number.isInteger(config.digits) ? config.digits : 6;
  const unit = quotaPerUnit > 0 ? quotaPerUnit : 1;
  const rate = usdExchangeRate > 0 ? usdExchangeRate : 1;
  const value = (quotaNumber / unit) * rate;
  const fixedValue = value.toFixed(digits);

  if (parseFloat(fixedValue) === 0 && quotaNumber > 0 && value > 0) {
    const minValue = Math.pow(10, -digits);
    return `¥${minValue.toFixed(digits)}`;
  }

  return `¥${fixedValue}`;
}

export function formatAffiliateRawQuota(quota) {
  return numberFormatter.format(safeNumber(quota, 0));
}
