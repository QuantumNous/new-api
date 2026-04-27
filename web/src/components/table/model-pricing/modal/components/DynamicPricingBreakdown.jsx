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

import React from 'react';
import { Avatar } from '@heroui/react';
import { Tag as PriceTagIcon } from 'lucide-react';
import { parseTiersFromExpr, getCurrencyConfig } from '../../../../../helpers';
import { BILLING_PRICING_VARS } from '../../../../../constants';
import {
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  SOURCE_TIME,
  MATCH_RANGE,
  MATCH_EQ,
  MATCH_GTE,
  MATCH_LT,
  MATCH_CONTAINS,
  MATCH_EXISTS,
} from '../../../../../pages/Setting/Ratio/components/requestRuleExpr';

const VAR_LABELS = { p: '输入', c: '输出' };
const OP_LABELS = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' };
const TIME_FUNC_LABELS = {
  hour: '小时',
  minute: '分钟',
  weekday: '星期',
  month: '月份',
  day: '日期',
};

// Inline chip rendered with the same Tailwind primitives the rest of the
// pricing surface uses (rather than the v2 Semi `<Tag>`). `tone` mirrors
// the legacy color prop: blue for tier label, orange for multiplier,
// amber for the section icon.
const TONE_CLASSES = {
  blue: 'bg-primary/15 text-primary',
  orange: 'bg-warning/15 text-warning',
  default: 'bg-surface-secondary text-foreground',
};

function ToneChip({ tone = 'default', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        TONE_CLASSES[tone] || TONE_CLASSES.default
      } ${className}`}
    >
      {children}
    </span>
  );
}

function formatTokenHint(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  if (n >= 1000000)
    return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function formatConditionSummary(conditions, t) {
  return conditions
    .map((c) => {
      if (c.var && c.op) {
        const varLabel = t(VAR_LABELS[c.var] || c.var);
        const hint = formatTokenHint(c.value);
        return `${varLabel} ${OP_LABELS[c.op] || c.op} ${hint || c.value}`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' && ');
}

function describeCondition(cond, t) {
  if (cond.source === SOURCE_TIME) {
    const fn = t(TIME_FUNC_LABELS[cond.timeFunc] || cond.timeFunc);
    const tz = cond.timezone || 'UTC';
    if (cond.mode === MATCH_RANGE) {
      return `${fn} ${cond.rangeStart}:00~${cond.rangeEnd}:00 (${tz})`;
    }
    const opMap = { [MATCH_EQ]: '=', [MATCH_GTE]: '≥', [MATCH_LT]: '<' };
    return `${fn} ${opMap[cond.mode] || '='} ${cond.value} (${tz})`;
  }
  const src = cond.source === 'header' ? t('请求头') : t('请求参数');
  const path = cond.path || '';
  if (cond.mode === MATCH_EXISTS) return `${src} ${path} ${t('存在')}`;
  if (cond.mode === MATCH_CONTAINS)
    return `${src} ${path} ${t('包含')} "${cond.value}"`;
  const opMap = { eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤' };
  return `${src} ${path} ${opMap[cond.mode] || '='} ${cond.value}`;
}

function describeGroup(group, t) {
  const parts = (group.conditions || []).map((c) => describeCondition(c, t));
  return parts.join(' && ');
}

export default function DynamicPricingBreakdown({ billingExpr, t }) {
  const { symbol, rate } = getCurrencyConfig();
  const { billingExpr: baseExpr, requestRuleExpr: ruleExpr } =
    splitBillingExprAndRequestRules(billingExpr || '');

  const tiers = parseTiersFromExpr(baseExpr);
  const ruleGroups = tryParseRequestRuleExpr(ruleExpr || '');

  const hasTiers = tiers && tiers.length > 0;
  const hasRules = ruleGroups && ruleGroups.length > 0;

  const headerIcon = (
    <Avatar size='sm' color='warning' className='mr-2 shadow-md'>
      <Avatar.Fallback>
        <PriceTagIcon size={16} />
      </Avatar.Fallback>
    </Avatar>
  );

  if (!hasTiers && !hasRules) {
    return (
      <div>
        <div className='mb-3 flex items-center'>
          {headerIcon}
          <span className='text-lg font-medium text-foreground'>
            {t('动态计费')}
          </span>
        </div>
        <code className='block break-all text-xs text-muted'>
          {billingExpr}
        </code>
      </div>
    );
  }

  // Only the price columns the active expression actually uses get rendered
  // (e.g. don't show a `cc1h` column if no tier prices it).
  const priceColumns = BILLING_PRICING_VARS.filter(
    ({ field }) => hasTiers && tiers.some((tier) => tier[field] > 0),
  ).map(({ field, shortLabel }) => ({ field, shortLabel }));

  return (
    <div>
      <div className='mb-4 flex items-center'>
        {headerIcon}
        <div>
          <div className='text-lg font-medium text-foreground'>
            {t('动态计费')}
          </div>
          <div className='text-xs text-muted'>
            {t('价格根据用量档位和请求条件动态调整')}
          </div>
        </div>
      </div>

      {hasTiers && (
        <div className='mb-4'>
          <div className='mb-2 text-sm font-semibold text-foreground'>
            {t('分档价格表')}
          </div>
          <div className='overflow-x-auto rounded-xl border border-border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                <tr>
                  <th className='px-3 py-2 font-medium'>{t('档位')}</th>
                  {priceColumns.map(({ field, shortLabel }) => (
                    <th key={field} className='px-3 py-2 font-medium'>
                      {`${t(shortLabel)} (${symbol}/1M tokens)`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {tiers.map((tier, i) => {
                  const condSummary = formatConditionSummary(
                    tier.conditions,
                    t,
                  );
                  return (
                    <tr key={`tier-${i}`} className='align-top'>
                      <td className='px-3 py-2'>
                        <ToneChip tone='blue'>
                          {tier.label || t('默认')}
                        </ToneChip>
                        {condSummary ? (
                          <div className='mt-1 text-xs text-muted'>
                            {condSummary}
                          </div>
                        ) : null}
                      </td>
                      {priceColumns.map(({ field }) => {
                        const v = tier[field] || 0;
                        return (
                          <td key={field} className='px-3 py-2'>
                            {v > 0 ? (
                              <span className='font-semibold text-foreground'>
                                {`${symbol}${(v * rate).toFixed(4)}`}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasRules && (
        <div className='mb-4'>
          <div className='mb-2 text-sm font-semibold text-foreground'>
            {t('条件乘数')}
          </div>
          {ruleGroups.map((group, gi) => (
            <div
              key={`group-${gi}`}
              className='mb-1 flex items-center justify-between rounded-md bg-surface-secondary px-3 py-2'
            >
              <span className='text-xs text-foreground'>
                {describeGroup(group, t)}
              </span>
              <ToneChip tone='orange'>{`${group.multiplier}x`}</ToneChip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
