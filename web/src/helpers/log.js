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

export function getLogOther(otherStr) {
  if (otherStr === undefined || otherStr === null || otherStr === '') {
    return {};
  }
  if (typeof otherStr === 'object') {
    return otherStr;
  }
  try {
    return JSON.parse(otherStr);
  } catch (e) {
    console.error(`Failed to parse record.other: "${otherStr}".`, e);
    return null;
  }
}

function normalizeFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTierTokenValue(value) {
  const normalized = normalizeFiniteNumber(value);
  if (normalized === null) {
    return '-';
  }
  if (normalized >= 1000000 && normalized % 1000000 === 0) {
    return `${normalized / 1000000}M`;
  }
  if (normalized >= 1000 && normalized % 1000 === 0) {
    return `${normalized / 1000}k`;
  }
  return `${normalized}`;
}

export function getUsageLogBillingQuotaType(other) {
  if (!other) {
    return null;
  }
  const explicitQuotaType = normalizeFiniteNumber(other.billing_quota_type);
  if (explicitQuotaType === 0 || explicitQuotaType === 1) {
    return explicitQuotaType;
  }
  if (other?.tier_pricing_enabled === true) {
    return 0;
  }
  return null;
}

export function getUsageLogModelPriceForRender(other) {
  const quotaType = getUsageLogBillingQuotaType(other);
  if (quotaType === 0) {
    return -1;
  }

  const modelPrice = normalizeFiniteNumber(other?.model_price);
  if (quotaType === 1) {
    return modelPrice ?? 0;
  }

  if (other?.tier_pricing_enabled === true) {
    return -1;
  }

  return modelPrice ?? -1;
}

export function describeUsageLogTierPricing(other, t) {
  if (!other?.tier_pricing_enabled) {
    return null;
  }

  const tierIndex = normalizeFiniteNumber(other?.tier_index);
  const tierLabel =
    tierIndex === null
      ? t('阶梯定价')
      : t('阶梯第 {{index}} 档', { index: tierIndex + 1 });

  const minTokens = normalizeFiniteNumber(other?.tier_min_tokens);
  const maxTokens = normalizeFiniteNumber(other?.tier_max_tokens);
  const basisValue = normalizeFiniteNumber(other?.tier_basis_value);

  let rangeText = null;
  if (minTokens !== null) {
    rangeText =
      maxTokens === null
        ? `>= ${formatTierTokenValue(minTokens)}`
        : `${formatTierTokenValue(minTokens)} <= x < ${formatTierTokenValue(maxTokens)}`;
  }

  const parts = [tierLabel];
  if (rangeText) {
    parts.push(t('区间 {{range}}', { range: rangeText }));
  }
  if (basisValue !== null) {
    parts.push(
      t('命中 {{value}} tokens', {
        value: formatTierTokenValue(basisValue),
      }),
    );
  }
  return parts.join(' · ');
}
