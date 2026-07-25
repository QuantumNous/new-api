// 额度展示换算，精简拷贝自 web/classic/src/helpers/render.jsx renderQuota
// （去掉 Semi 相关渲染，仅保留 USD/CNY/TOKENS/CUSTOM 数值逻辑）。

function readStatus() {
  try {
    const s = localStorage.getItem('status');
    return s ? JSON.parse(s) : {};
  } catch (e) {
    return {};
  }
}

export function pointsEnabled() {
  return localStorage.getItem('points_enabled') === 'true';
}

// 积分展示：quota → 积分。与 PC 端 helpers/quota.js quotaToPoints 完全同口径：
// floor 取整（积分不显示小数）+ 1e-9 浮点护栏 + quota_per_point 默认 684.93。
export function renderPoints(quota) {
  const raw = parseFloat(localStorage.getItem('quota_per_point') || '684.93');
  const per = Number.isFinite(raw) && raw > 0 ? raw : 684.93;
  const q = Number(quota || 0);
  if (!Number.isFinite(q) || q <= 0) return '0';
  return String(Math.floor(q / per + 1e-9));
}

// 大数字缩写，拷贝自 PC helpers/render.jsx renderNumber（TOKENS 展示模式用）
function renderNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return `${num}`;
}

export function renderQuota(quota, digits = 2) {
  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit'));
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS' || !quotaPerUnit) {
    return renderNumber(quota);
  }
  const resultUSD = quota / quotaPerUnit;
  let symbol = '$';
  let value = resultUSD;
  if (quotaDisplayType === 'CNY') {
    const status = readStatus();
    value = resultUSD * (status?.usd_exchange_rate || 1);
    symbol = '¥';
  } else if (quotaDisplayType === 'CUSTOM') {
    const status = readStatus();
    value = resultUSD * (status?.custom_currency_exchange_rate || 1);
    symbol = status?.custom_currency_symbol || '¤';
  }
  return `${symbol}${value.toFixed(digits)}`;
}
