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
  kpi_tier_code: 'KPI Tier Code',
  amount_cents: 'Reward Amount (yuan)',
  first_recharge_min_cents: 'First Recharge Minimum (yuan)',
  period_net_paid_min_cents: 'Period Net Paid Minimum (yuan)',
  qualification_days: 'Qualification Days',
  unlock_delay_days: 'Unlock Delay Days',
  max_refund_ratio_bps: 'Max Refund Ratio (%)',
  value: 'Value',
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

function getRuleFieldLabel(key) {
  return RULE_FIELD_LABELS[key] || key;
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

const RuleFields = ({ t, item, onChange, hiddenKeys = [] }) => (
  <div className='grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2'>
    {Object.entries(item)
      .filter(([key]) => !hiddenKeys.includes(key))
      .map(([key, fieldValue]) => (
        <div key={key}>
          <div className='flex items-baseline gap-1 min-h-[18px]'>
            <Text size='small'>{t(getRuleFieldLabel(key))}</Text>
          </div>
          {typeof fieldValue === 'boolean' ? (
            <Select
              className='w-full'
              value={String(fieldValue)}
              onChange={(nextValue) => onChange(key, nextValue)}
            >
              <Select.Option value='true'>true</Select.Option>
              <Select.Option value='false'>false</Select.Option>
            </Select>
          ) : (
            <Input
              type={typeof fieldValue === 'number' ? 'number' : 'text'}
              step={isPercentField(key) || isYuanField(key) ? 0.01 : undefined}
              value={getDisplayValue(key, fieldValue)}
              onChange={(nextValue) => onChange(key, nextValue)}
            />
          )}
        </div>
      ))}
  </div>
);

const RuleArrayEditor = ({ t, title, field, formApi, description }) => {
  const [revision, setRevision] = useState(0);
  const value = formApi?.getValue?.(field) || '[]';
  const parsed = useMemo(() => parseRuleArray(value), [value, revision]);

  const writeItems = (items) => {
    formApi?.setValue?.(field, stringifyRuleArray(items));
    setRevision((current) => current + 1);
  };

  const updateItem = (index, key, nextValue) => {
    const next = parsed.items.map((item) => ({ ...item }));
    next[index][key] = coerceRuleFieldValue(key, nextValue, next[index][key]);
    writeItems(next);
  };

  const addItem = () => {
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
          <Button htmlType='button' type='tertiary' onClick={addItem}>
            {t('Add Rule')}
          </Button>
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
          <div className='flex flex-col gap-2'>
            {parsed.items.map((item, index) => (
              <Card
                key={index}
                className='!rounded-lg bg-semi-color-fill-0'
                bodyStyle={{ padding: 10 }}
              >
                <div className='flex justify-between items-center mb-2'>
                  <Text strong>
                    {title} #{index + 1}
                  </Text>
                  <Button
                    htmlType='button'
                    type='danger'
                    theme='borderless'
                    onClick={() => removeItem(index)}
                  >
                    {t('Remove')}
                  </Button>
                </div>
                <RuleFields
                  t={t}
                  item={item}
                  onChange={(key, nextValue) =>
                    updateItem(index, key, nextValue)
                  }
                />
              </Card>
            ))}
          </div>
        )}

        <Form.TextArea field={field} style={{ display: 'none' }} />
      </div>
    </Card>
  );
};

export const RuleLevelGroupedEditor = ({ t, sections, formApi }) => {
  const [, setRevision] = useState(0);
  const levels = [1, 2];

  const parseField = (field) =>
    parseRuleArray(formApi?.getValue?.(field) || '[]');

  const writeItems = (field, items) => {
    formApi?.setValue?.(field, stringifyRuleArray(items));
    setRevision((current) => current + 1);
  };

  const updateItem = (field, itemIndex, key, nextValue) => {
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
                        <Button
                          htmlType='button'
                          type='tertiary'
                          onClick={() => addItem(section.field, level)}
                        >
                          {t('Add Rule')}
                        </Button>
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
                        <div className='flex flex-col gap-2'>
                          {items.map(({ item, index }, visualIndex) => (
                            <Card
                              key={`${section.field}-${index}`}
                              className='!rounded-lg'
                              bodyStyle={{ padding: 10 }}
                            >
                              <div className='flex items-center justify-between gap-2 mb-2'>
                                <Text strong>
                                  {section.title} #{visualIndex + 1}
                                </Text>
                                <Button
                                  htmlType='button'
                                  type='danger'
                                  theme='borderless'
                                  onClick={() =>
                                    removeItem(section.field, index)
                                  }
                                >
                                  {t('Remove')}
                                </Button>
                              </div>
                              <RuleFields
                                t={t}
                                item={item}
                                hiddenKeys={['affiliate_level']}
                                onChange={(key, nextValue) =>
                                  updateItem(
                                    section.field,
                                    index,
                                    key,
                                    nextValue,
                                  )
                                }
                              />
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        {sections.map((section) => (
          <Form.TextArea
            key={section.field}
            field={section.field}
            style={{ display: 'none' }}
          />
        ))}
      </div>
    </Card>
  );
};

export default RuleArrayEditor;
