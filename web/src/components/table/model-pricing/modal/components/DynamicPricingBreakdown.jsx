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
import { Avatar, Tag, Table, Typography } from '@douyinfe/semi-ui';
import { IconPriceTag } from '@douyinfe/semi-icons';
import { parseTiersFromExpr, getCurrencyConfig } from '../../../../../helpers';
import { BILLING_VARS } from '../../../../../constants';
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

const { Text } = Typography;

const VAR_LABELS = { p: '输入', c: '输出' };
const OP_LABELS = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' };
const TIME_FUNC_LABELS = { hour: '小时', minute: '分钟', weekday: '星期', month: '月份', day: '日期' };

function formatTokenHint(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
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
  if (cond.mode === MATCH_CONTAINS) return `${src} ${path} ${t('包含')} "${cond.value}"`;
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

  if (!hasTiers && !hasRules) {
    return (
      <div>
        <div className='flex items-center mb-3'>
          <Avatar size='small' color='amber' className='mr-2 shadow-md'>
            <IconPriceTag size={16} />
          </Avatar>
          <Text className='text-lg font-medium'>{t('动态计费')}</Text>
        </div>
        <div className='text-sm text-gray-500'>
          <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{billingExpr}</code>
        </div>
      </div>
    );
  }

  const priceFields = BILLING_VARS.map((v) => [v.field, v.shortLabel]);

  const tierColumns = [
    {
      title: t('档位'),
      dataIndex: 'label',
      render: (text, record) => (
        <div>
          <Tag color='blue' size='small'>{text || t('默认')}</Tag>
          {record.condSummary && (
            <div className='text-xs text-gray-500 mt-1'>{record.condSummary}</div>
          )}
        </div>
      ),
    },
    ...priceFields
      .filter(([field]) => hasTiers && tiers.some((tier) => tier[field] > 0))
      .map(([field, label]) => ({
        title: `${t(label)} (${symbol}/1M tokens)`,
        dataIndex: field,
        render: (v) => v > 0 ? <Text strong>{`${symbol}${(v * rate).toFixed(4)}`}</Text> : '-',
      })),
  ];

  const tierData = hasTiers
    ? tiers.map((tier, i) => ({
        key: `tier-${i}`,
        label: tier.label,
        condSummary: formatConditionSummary(tier.conditions, t),
        ...Object.fromEntries(priceFields.map(([field]) => [field, tier[field] || 0])),
      }))
    : [];

  return (
    <div>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='amber' className='mr-2 shadow-md'>
          <IconPriceTag size={16} />
        </Avatar>
        <div>
          <Text className='text-lg font-medium'>{t('动态计费')}</Text>
          <div className='text-xs text-gray-600'>
            {t('价格根据用量档位和请求条件动态调整')}
          </div>
        </div>
      </div>

      {hasTiers && (
        <div style={{ marginBottom: 16 }}>
          <Text strong className='text-sm' style={{ display: 'block', marginBottom: 8 }}>
            {t('分档价格表')}
          </Text>
          <Table
            dataSource={tierData}
            columns={tierColumns}
            pagination={false}
            size='small'
            bordered={false}
            className='!rounded-lg'
          />
        </div>
      )}

      {hasRules && (
        <div style={{ marginBottom: 16 }}>
          <Text strong className='text-sm' style={{ display: 'block', marginBottom: 8 }}>
            {t('条件乘数')}
          </Text>
          {ruleGroups.map((group, gi) => (
            <div
              key={`group-${gi}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--semi-color-fill-0)',
                marginBottom: 4,
              }}
            >
              <Text size='small'>{describeGroup(group, t)}</Text>
              <Tag color='orange' size='small'>{group.multiplier}x</Tag>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
