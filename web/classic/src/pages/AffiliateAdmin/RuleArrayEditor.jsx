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

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Typography,
} from '@douyinfe/semi-ui';

const { Text } = Typography;

const RULE_FIELD_LABELS = {
  affiliate_level: 'Affiliate Level',
  name: 'Name',
  status: 'Status',
  code: 'Code',
  default_rate_bps: 'Default Rate (%)',
  default_cap_rate_bps: 'Default Cap Rate (%)',
  min_settlement_amount_cents: 'Minimum Settlement Amount (yuan)',
  allow_manual_approval_rate: 'Allow Manual Approval Rate',
  min_net_paid_amount_cents: 'Minimum Net Paid (yuan)',
  max_net_paid_amount_cents: 'Maximum Net Paid (yuan)',
  base_rate_bps: 'Base Rate (%)',
  cap_rate_bps: 'Cap Rate (%)',
  requires_manual_approval: 'Requires Manual Approval',
  sort_order: 'Sort Order',
  coefficient_bps: 'KPI Coefficient (%)',
  min_effective_new_users: 'Minimum Effective New Users',
  max_gift_only_ratio_bps: 'Max Gift-Only Ratio (%)',
  max_abnormal_ratio_bps: 'Max Abnormal Ratio (%)',
  min_second_payment_ratio_bps: 'Minimum Second-Payment Ratio (%)',
  self_brush_strategy: 'Self-Brush Strategy',
  bulk_abuse_strategy: 'Bulk-Abuse Strategy',
  action: 'Processing Action',
  kpi_tier_code: 'KPI Tier Code',
  amount_cents: 'Reward Amount (yuan)',
  first_recharge_min_cents: 'First Recharge Minimum (yuan)',
  period_net_paid_min_cents: 'Period Net Paid Minimum (yuan)',
  qualification_days: 'Qualification Days',
  unlock_delay_days: 'Unlock Delay Days',
  max_refund_ratio_bps: 'Max Refund Ratio (%)',
  value: 'Value',
};

const RULE_FIELD_ORDER = Object.keys(RULE_FIELD_LABELS);
const REVIEW_ACTION_OPTIONS = [
  { value: 'exclude', label: 'Exclude' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'hold_settlement', label: 'Hold Settlement' },
];
const KPI_TIER_OPTIONS = [
  { value: 'observe', label: 'Observe' },
  { value: 'base', label: 'Base' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'growth', label: 'Growth' },
  { value: 'excellent', label: 'Excellent' },
];
const RULE_FIELD_OPTIONS = {
  status: [
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
  ],
  self_brush_strategy: REVIEW_ACTION_OPTIONS,
  bulk_abuse_strategy: REVIEW_ACTION_OPTIONS,
  action: REVIEW_ACTION_OPTIONS,
  kpi_tier_code: KPI_TIER_OPTIONS,
};

function parseRuleArray(value) {
  const text = String(value || '').trim();
  if (!text) {
    return { items: [], error: '' };
  }
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { items: [], error: 'JSON 必须是数组' };
    }
    return {
      items: parsed.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? item
          : { value: item },
      ),
      error: '',
    };
  } catch (error) {
    return { items: [], error: error.message || 'JSON 格式错误' };
  }
}

function stringifyRuleArray(items) {
  return JSON.stringify(items, null, 2);
}

function coerceByOriginalType(value, original) {
  if (typeof original === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  if (typeof original === 'boolean') {
    return value === true || value === 'true';
  }
  if (original === null) {
    return value === '' ? null : value;
  }
  return value;
}

function emptyValueLike(value) {
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  return '';
}

function isPercentField(key) {
  return String(key || '').endsWith('_bps');
}

function isYuanField(key) {
  return String(key || '').endsWith('_cents');
}

function formatScaledNumber(value, divisor = 100) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return '0.00';
  }
  return (number / divisor).toFixed(2);
}

function getDisplayValue(key, value) {
  if (isPercentField(key) || isYuanField(key)) {
    return formatScaledNumber(value, 100);
  }
  return value == null ? '' : String(value);
}

function coerceRuleFieldValue(key, value, original) {
  if (isPercentField(key) || isYuanField(key)) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }
  return coerceByOriginalType(value, original);
}

function humanizeRuleFieldKey(key) {
  return String(key || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRuleFieldLabel(key) {
  return RULE_FIELD_LABELS[key] || humanizeRuleFieldKey(key);
}

function getRuleFieldOptions(key, currentValue, dynamicOptions = {}) {
  const options =
    dynamicOptions[key]?.length > 0
      ? dynamicOptions[key]
      : RULE_FIELD_OPTIONS[key];
  if (!options) {
    return [];
  }

  const value = currentValue == null ? '' : String(currentValue);
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [...options, { value, label: value }];
}

function isOpenEndedMaxNetPaid(fieldKey, value) {
  return fieldKey === 'max_net_paid_amount_cents' && Number(value || 0) === 0;
}

function getKPITierCodeOptions(items, level) {
  const seen = new Set();
  const options = [];
  for (const item of items) {
    if (Number(item?.affiliate_level || 0) !== level) continue;
    const value = String(item?.code || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const name = String(item?.name || '').trim();
    options.push({
      value,
      label: name ? `${name} (${value})` : value,
    });
  }
  return options;
}

function getRuleTableColumns(items, hiddenKeys = []) {
  const hidden = new Set(hiddenKeys);
  const fieldOrder = new Map(
    RULE_FIELD_ORDER.map((field, index) => [field, index]),
  );
  const columns = new Set();

  for (const item of items) {
    for (const key of Object.keys(item || {})) {
      if (!hidden.has(key)) {
        columns.add(key);
      }
    }
  }

  return [...columns].sort((a, b) => {
    const aOrder = fieldOrder.get(a);
    const bOrder = fieldOrder.get(b);
    if (aOrder === undefined && bOrder === undefined) {
      return a.localeCompare(b);
    }
    if (aOrder === undefined) return 1;
    if (bOrder === undefined) return -1;
    return aOrder - bOrder;
  });
}

function getRuleLevelTitle(t, level) {
  if (Number(level) === 1) {
    return t('Level-one Affiliate Rules');
  }
  if (Number(level) === 2) {
    return t('Level-two Affiliate Rules');
  }
  return t('Affiliate Level {{level}}').replace('{{level}}', String(level));
}

function getRuleCellValue(item, key) {
  return Object.prototype.hasOwnProperty.call(item, key) ? item[key] : '';
}

const RuleFieldControl = ({
  t,
  fieldKey,
  fieldValue,
  fieldOptions,
  readOnly = false,
  onChange,
}) => {
  const options = getRuleFieldOptions(fieldKey, fieldValue, fieldOptions);
  if (options.length > 0) {
    return (
      <Select
        className='min-w-[144px]'
        disabled={readOnly}
        value={fieldValue == null ? '' : String(fieldValue)}
        onChange={(nextValue) => onChange(String(nextValue))}
      >
        {options.map((option) => (
          <Select.Option key={option.value} value={option.value}>
            {t(option.label)}
          </Select.Option>
        ))}
      </Select>
    );
  }

  if (typeof fieldValue === 'boolean') {
    return (
      <Select
        className='min-w-[112px]'
        disabled={readOnly}
        value={String(fieldValue)}
        onChange={(nextValue) => onChange(nextValue)}
      >
        <Select.Option value='true'>{t('Enabled')}</Select.Option>
        <Select.Option value='false'>{t('Disabled')}</Select.Option>
      </Select>
    );
  }

  return (
    <div className='flex min-w-[128px] flex-col gap-1'>
      <Input
        className='min-w-[128px]'
        type={
          typeof fieldValue === 'number' ||
          isPercentField(fieldKey) ||
          isYuanField(fieldKey)
            ? 'number'
            : 'text'
        }
        step={
          isPercentField(fieldKey) || isYuanField(fieldKey) ? 0.01 : undefined
        }
        value={getDisplayValue(fieldKey, fieldValue)}
        disabled={readOnly}
        onChange={(nextValue) => onChange(nextValue)}
      />
      {isOpenEndedMaxNetPaid(fieldKey, fieldValue) && (
        <Text type='tertiary' size='small'>
          {t('0 表示不限')}
        </Text>
      )}
    </div>
  );
};

const RuleTable = ({
  t,
  rows,
  hiddenKeys = [],
  fieldOptions,
  readOnly = false,
  onChange,
  onRemove,
}) => {
  const columns = getRuleTableColumns(
    rows.map((row) => row.item),
    hiddenKeys,
  );

  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='min-w-full border-collapse text-sm'>
        <thead className='bg-semi-color-fill-0'>
          <tr>
            <th className='w-14 whitespace-nowrap border-b px-3 py-2 text-left font-medium text-semi-color-text-2'>
              #
            </th>
            {columns.map((key) => (
              <th
                key={key}
                className='min-w-[144px] whitespace-nowrap border-b px-3 py-2 text-left font-medium text-semi-color-text-2'
              >
                {t(getRuleFieldLabel(key))}
              </th>
            ))}
            {!readOnly && (
              <th className='w-24 whitespace-nowrap border-b px-3 py-2 text-left font-medium text-semi-color-text-2'>
                {t('操作')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, visualIndex) => (
            <tr key={row.index} className='border-b last:border-b-0'>
              <td className='px-3 py-2 align-middle text-semi-color-text-2'>
                #{visualIndex + 1}
              </td>
              {columns.map((key) => {
                const fieldValue = getRuleCellValue(row.item, key);
                return (
                  <td key={key} className='px-3 py-2 align-middle'>
                    <RuleFieldControl
                      t={t}
                      fieldKey={key}
                      fieldValue={fieldValue}
                      fieldOptions={fieldOptions}
                      readOnly={readOnly}
                      onChange={(nextValue) =>
                        onChange(row.index, key, nextValue)
                      }
                    />
                  </td>
                );
              })}
              {!readOnly && (
                <td className='px-3 py-2 align-middle'>
                  <Button
                    htmlType='button'
                    type='danger'
                    theme='borderless'
                    onClick={() => onRemove(row.index)}
                  >
                    {t('Remove')}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RuleArrayEditor = ({
  t,
  title,
  field,
  formApi,
  description,
  readOnly = false,
}) => {
  const [revision, setRevision] = useState(0);
  const value = formApi?.getValue?.(field) || '[]';
  const parsed = useMemo(() => parseRuleArray(value), [value, revision]);

  const writeItems = (items) => {
    if (readOnly) return;
    formApi?.setValue?.(field, stringifyRuleArray(items));
    setRevision((current) => current + 1);
  };

  const updateItem = (index, key, nextValue) => {
    if (readOnly) return;
    const next = parsed.items.map((item) => ({ ...item }));
    next[index][key] = coerceRuleFieldValue(key, nextValue, next[index][key]);
    writeItems(next);
  };

  const addItem = () => {
    if (readOnly) return;
    const template = parsed.items[0] || { affiliate_level: 1 };
    const item = Object.fromEntries(
      Object.entries(template).map(([key, fieldValue]) => [
        key,
        emptyValueLike(fieldValue),
      ]),
    );
    writeItems([...parsed.items, item]);
  };

  const removeItem = (index) => {
    if (readOnly) return;
    writeItems(parsed.items.filter((_, current) => current !== index));
  };

  return (
    <Card className='!rounded-xl' title={title} bodyStyle={{ padding: 12 }}>
      <div className='flex flex-col gap-2'>
        <div className='flex justify-between items-start gap-2'>
          <div className='flex flex-col gap-1'>
            <Text type='secondary' size='small'>
              {description ||
                t(
                  'Use visual cards for array objects. Switch to JSON mode for complex batch edits.',
                )}
            </Text>
            <Text type='tertiary' size='small'>
              {t(
                'Percent fields are shown as %, amount fields are shown in yuan with two decimals.',
              )}
            </Text>
          </div>
          {!readOnly && (
            <Button htmlType='button' type='tertiary' onClick={addItem}>
              {t('Add Rule')}
            </Button>
          )}
        </div>

        {parsed.error ? (
          <div className='rounded-lg border p-3 text-red-600'>
            {parsed.error}
          </div>
        ) : parsed.items.length === 0 ? (
          <Empty
            title={t('No rules yet')}
            description={t(
              'This rule array is empty and will be submitted as an empty array.',
            )}
          />
        ) : (
          <RuleTable
            t={t}
            rows={parsed.items.map((item, index) => ({ item, index }))}
            readOnly={readOnly}
            onChange={updateItem}
            onRemove={removeItem}
          />
        )}

        <div style={{ display: 'none' }}>
          <Form.TextArea field={field} noLabel />
        </div>
      </div>
    </Card>
  );
};

export const RuleLevelGroupedEditor = ({
  t,
  sections,
  formApi,
  readOnly = false,
}) => {
  const [, setRevision] = useState(0);
  const levels = [1, 2];

  const parseField = (field) =>
    parseRuleArray(formApi?.getValue?.(field) || '[]');

  const writeItems = (field, items) => {
    if (readOnly) return;
    formApi?.setValue?.(field, stringifyRuleArray(items));
    setRevision((current) => current + 1);
  };

  const updateItem = (field, itemIndex, key, nextValue) => {
    if (readOnly) return;
    const parsed = parseField(field);
    const next = parsed.items.map((item) => ({ ...item }));
    next[itemIndex][key] = coerceRuleFieldValue(
      key,
      nextValue,
      next[itemIndex][key],
    );
    writeItems(field, next);
  };

  const addItem = (field, level) => {
    if (readOnly) return;
    const parsed = parseField(field);
    const template = parsed.items.find(
      (item) => Number(item.affiliate_level) === level,
    ) ||
      parsed.items[0] || { affiliate_level: level };
    const item = Object.fromEntries(
      Object.entries(template).map(([key, fieldValue]) => [
        key,
        key === 'affiliate_level' ? level : emptyValueLike(fieldValue),
      ]),
    );
    item.affiliate_level = level;
    writeItems(field, [...parsed.items, item]);
  };

  const removeItem = (field, itemIndex) => {
    if (readOnly) return;
    const parsed = parseField(field);
    writeItems(
      field,
      parsed.items.filter((_, current) => current !== itemIndex),
    );
  };

  return (
    <Card
      className='!rounded-xl'
      title={t('Rules grouped by affiliate level')}
      bodyStyle={{ padding: 12 }}
    >
      <div className='flex flex-col gap-3'>
        <div className='flex flex-col gap-1'>
          <Text type='secondary' size='small'>
            {t(
              'Each column groups all rule types for one affiliate level. Switch to JSON mode for complex batch edits.',
            )}
          </Text>
          <Text type='tertiary' size='small'>
            {t(
              'Percent fields are shown as %, amount fields are shown in yuan with two decimals.',
            )}
          </Text>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-2 gap-3'>
          {levels.map((level) => (
            <Card
              key={level}
              className='!rounded-xl bg-semi-color-fill-0'
              title={getRuleLevelTitle(t, level)}
              bodyStyle={{ padding: 12 }}
            >
              <div className='flex flex-col gap-3'>
                {sections.map((section) => {
                  const parsed = parseField(section.field);
                  const kpiTierOptions = getKPITierCodeOptions(
                    parseField('kpi_tiers_json').items,
                    level,
                  );
                  const items = parsed.items
                    .map((item, index) => ({ item, index }))
                    .filter(
                      ({ item }) => Number(item.affiliate_level || 0) === level,
                    );
                  return (
                    <div
                      key={section.field}
                      className='rounded-xl border bg-white/70 p-3'
                    >
                      <div className='flex items-start justify-between gap-2 mb-2'>
                        <div className='min-w-0'>
                          <Text strong>{section.title}</Text>
                          {section.description && (
                            <div>
                              <Text type='secondary' size='small'>
                                {section.description}
                              </Text>
                            </div>
                          )}
                        </div>
                        {!readOnly && (
                          <Button
                            htmlType='button'
                            type='tertiary'
                            onClick={() => addItem(section.field, level)}
                          >
                            {t('Add Rule')}
                          </Button>
                        )}
                      </div>

                      {parsed.error ? (
                        <div className='rounded-lg border p-3 text-red-600'>
                          {parsed.error}
                        </div>
                      ) : items.length === 0 ? (
                        <Empty
                          title={t('No rules yet')}
                          description={t(
                            'This level has no rules for this rule type.',
                          )}
                        />
                      ) : (
                        <RuleTable
                          t={t}
                          rows={items}
                          hiddenKeys={['affiliate_level']}
                          fieldOptions={{ kpi_tier_code: kpiTierOptions }}
                          readOnly={readOnly}
                          onChange={(index, key, nextValue) =>
                            updateItem(section.field, index, key, nextValue)
                          }
                          onRemove={(index) => removeItem(section.field, index)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'none' }}>
          {sections.map((section) => (
            <Form.TextArea key={section.field} field={section.field} noLabel />
          ))}
        </div>
      </div>
    </Card>
  );
};

export const __ruleArrayEditorTestUtils = {
  coerceRuleFieldValue,
  getDisplayValue,
  getKPITierCodeOptions,
  getRuleFieldLabel,
  getRuleFieldOptions,
  getRuleTableColumns,
};

export default RuleArrayEditor;
