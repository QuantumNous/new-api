/*
Copyright (C) 2023-2026 QuantumNous

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
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

type RuleValue = string | number | boolean | null
type RuleRecord = Record<string, RuleValue>
type RuleTableRow = {
  item: RuleRecord
  index: number
}
type RuleFieldOption = {
  value: string
  label: string
}

const RULE_FIELD_LABELS: Record<string, string> = {
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
}

const RULE_FIELD_ORDER = Object.keys(RULE_FIELD_LABELS)
const REVIEW_ACTION_OPTIONS: RuleFieldOption[] = [
  { value: 'exclude', label: 'Exclude' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'hold_settlement', label: 'Hold Settlement' },
]
const KPI_TIER_OPTIONS: RuleFieldOption[] = [
  { value: 'observe', label: 'Observe' },
  { value: 'base', label: 'Base' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'growth', label: 'Growth' },
  { value: 'excellent', label: 'Excellent' },
]
const RULE_FIELD_OPTIONS: Record<string, RuleFieldOption[]> = {
  status: [
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
  ],
  self_brush_strategy: REVIEW_ACTION_OPTIONS,
  bulk_abuse_strategy: REVIEW_ACTION_OPTIONS,
  action: REVIEW_ACTION_OPTIONS,
  kpi_tier_code: KPI_TIER_OPTIONS,
}

function parseRuleArray(value: string | undefined): {
  items: RuleRecord[]
  error: string
} {
  const text = String(value || '').trim()
  if (!text) return { items: [], error: '' }
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      return { items: [], error: 'JSON must be an array' }
    }
    return {
      items: parsed.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as RuleRecord)
          : { value: item as RuleValue }
      ),
      error: '',
    }
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

function stringifyRuleArray(items: RuleRecord[]): string {
  return JSON.stringify(items, null, 2)
}

function coerceByOriginalType(value: string, original: RuleValue): RuleValue {
  if (typeof original === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }
  if (typeof original === 'boolean') {
    return value === 'true'
  }
  if (original === null) {
    return value === '' ? null : value
  }
  return value
}

function emptyValueLike(value: RuleValue): RuleValue {
  if (typeof value === 'number') return 0
  if (typeof value === 'boolean') return false
  return ''
}

function isPercentField(key: string): boolean {
  return key.endsWith('_bps')
}

function isYuanField(key: string): boolean {
  return key.endsWith('_cents')
}

function formatScaledNumber(value: RuleValue, divisor = 100): string {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0.00'
  return (number / divisor).toFixed(2)
}

function getDisplayValue(key: string, value: RuleValue): string {
  if (isPercentField(key) || isYuanField(key)) {
    return formatScaledNumber(value, 100)
  }
  return value == null ? '' : String(value)
}

function coerceRuleFieldValue(
  key: string,
  value: string,
  original: RuleValue
): RuleValue {
  if (isPercentField(key) || isYuanField(key)) {
    const number = Number(value)
    return Number.isFinite(number) ? Math.round(number * 100) : 0
  }
  return coerceByOriginalType(value, original)
}

function humanizeRuleFieldKey(key: string): string {
  return String(key || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRuleFieldLabel(key: string): string {
  return RULE_FIELD_LABELS[key] ?? humanizeRuleFieldKey(key)
}

function getRuleFieldOptions(
  key: string,
  currentValue?: RuleValue,
  dynamicOptions: Record<string, RuleFieldOption[]> = {}
): RuleFieldOption[] {
  const options = dynamicOptions[key]?.length
    ? dynamicOptions[key]
    : RULE_FIELD_OPTIONS[key]
  if (!options) return []

  const value = currentValue == null ? '' : String(currentValue)
  if (!value || options.some((option) => option.value === value)) {
    return options
  }

  return [...options, { value, label: value }]
}

function getKPITierCodeOptions(
  items: RuleRecord[],
  level: number
): RuleFieldOption[] {
  const seen = new Set<string>()
  const options: RuleFieldOption[] = []
  for (const item of items) {
    if (Number(item.affiliate_level || 0) !== level) continue
    const value = String(item.code || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    const name = String(item.name || '').trim()
    options.push({
      value,
      label: name ? `${name} (${value})` : value,
    })
  }
  return options
}

function getRuleTableColumns(
  items: RuleRecord[],
  hiddenKeys: string[] = []
): string[] {
  const hidden = new Set(hiddenKeys)
  const fieldOrder = new Map(
    RULE_FIELD_ORDER.map((field, index) => [field, index])
  )
  const columns = new Set<string>()

  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!hidden.has(key)) columns.add(key)
    }
  }

  return [...columns].sort((a, b) => {
    const aOrder = fieldOrder.get(a)
    const bOrder = fieldOrder.get(b)
    if (aOrder === undefined && bOrder === undefined) {
      return a.localeCompare(b)
    }
    if (aOrder === undefined) return 1
    if (bOrder === undefined) return -1
    return aOrder - bOrder
  })
}

function getRuleLevelTitle(level: number, t: (key: string) => string): string {
  if (level === 1) return t('Level-one Affiliate Rules')
  if (level === 2) return t('Level-two Affiliate Rules')
  return t('Affiliate Level {{level}}').replace('{{level}}', String(level))
}

function getRuleCellValue(item: RuleRecord, key: string): RuleValue {
  return Object.prototype.hasOwnProperty.call(item, key) ? item[key] : ''
}

function isOpenEndedMaxNetPaid(fieldKey: string, value: RuleValue): boolean {
  return fieldKey === 'max_net_paid_amount_cents' && Number(value || 0) === 0
}

function RuleFieldControl(props: {
  fieldKey: string
  value: RuleValue
  fieldOptions?: Record<string, RuleFieldOption[]>
  readOnly?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const options = getRuleFieldOptions(
    props.fieldKey,
    props.value,
    props.fieldOptions
  )
  if (options.length > 0) {
    return (
      <NativeSelect
        className='min-w-36'
        disabled={props.readOnly}
        value={props.value == null ? '' : String(props.value)}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {t(option.label)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    )
  }

  if (typeof props.value === 'boolean') {
    return (
      <NativeSelect
        className='min-w-28'
        disabled={props.readOnly}
        value={String(props.value)}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <NativeSelectOption value='true'>{t('Enabled')}</NativeSelectOption>
        <NativeSelectOption value='false'>{t('Disabled')}</NativeSelectOption>
      </NativeSelect>
    )
  }

  return (
    <div className='flex min-w-32 flex-col gap-1'>
      <Input
        className='min-w-32'
        type={
          typeof props.value === 'number' ||
          isPercentField(props.fieldKey) ||
          isYuanField(props.fieldKey)
            ? 'number'
            : 'text'
        }
        step={
          isPercentField(props.fieldKey) || isYuanField(props.fieldKey)
            ? 0.01
            : undefined
        }
        value={getDisplayValue(props.fieldKey, props.value)}
        disabled={props.readOnly}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {isOpenEndedMaxNetPaid(props.fieldKey, props.value) ? (
        <span className='text-muted-foreground text-xs'>
          {t('0 means unlimited')}
        </span>
      ) : null}
    </div>
  )
}

function RuleTable(props: {
  rows: RuleTableRow[]
  hiddenKeys?: string[]
  fieldOptions?: Record<string, RuleFieldOption[]>
  readOnly?: boolean
  onChange: (index: number, key: string, value: string) => void
  onRemove: (index: number) => void
}) {
  const { t } = useTranslation()
  const columns = getRuleTableColumns(
    props.rows.map((row) => row.item),
    props.hiddenKeys
  )

  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='min-w-full border-collapse text-sm'>
        <thead className='bg-muted/60'>
          <tr>
            <th className='text-muted-foreground w-14 border-b px-3 py-2 text-left font-medium whitespace-nowrap'>
              #
            </th>
            {columns.map((key) => (
              <th
                key={key}
                className='text-muted-foreground min-w-36 border-b px-3 py-2 text-left font-medium whitespace-nowrap'
              >
                {t(getRuleFieldLabel(key))}
              </th>
            ))}
            {!props.readOnly && (
              <th className='text-muted-foreground w-24 border-b px-3 py-2 text-left font-medium whitespace-nowrap'>
                {t('Actions')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, visualIndex) => (
            <tr key={row.index} className='border-b last:border-b-0'>
              <td className='text-muted-foreground px-3 py-2 align-middle'>
                #{visualIndex + 1}
              </td>
              {columns.map((key) => {
                const value = getRuleCellValue(row.item, key)
                return (
                  <td key={key} className='px-3 py-2 align-middle'>
                    <RuleFieldControl
                      fieldKey={key}
                      value={value}
                      fieldOptions={props.fieldOptions}
                      readOnly={props.readOnly}
                      onChange={(nextValue) =>
                        props.onChange(row.index, key, nextValue)
                      }
                    />
                  </td>
                )
              })}
              {!props.readOnly && (
                <td className='px-3 py-2 align-middle'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => props.onRemove(row.index)}
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
  )
}

export function RuleArrayEditor(props: {
  title: string
  description?: string
  value?: string
  readOnly?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const parsed = parseRuleArray(props.value)
  const items = parsed.items

  const updateItem = (index: number, key: string, value: string) => {
    if (props.readOnly) return
    const next = items.map((item) => ({ ...item }))
    next[index][key] = coerceRuleFieldValue(key, value, next[index][key])
    props.onChange(stringifyRuleArray(next))
  }

  const removeItem = (index: number) => {
    if (props.readOnly) return
    props.onChange(stringifyRuleArray(items.filter((_, i) => i !== index)))
  }

  const addItem = () => {
    if (props.readOnly) return
    const template = items[0] || { affiliate_level: 1 }
    const nextItem = Object.fromEntries(
      Object.entries(template).map(([key, value]) => [
        key,
        emptyValueLike(value),
      ])
    ) as RuleRecord
    props.onChange(stringifyRuleArray([...items, nextItem]))
  }

  return (
    <div className='rounded-xl border p-3'>
      <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
        <div>
          <div className='font-medium'>{props.title}</div>
          {props.description ? (
            <div className='text-muted-foreground text-xs'>
              {props.description}
            </div>
          ) : (
            <div className='text-muted-foreground text-xs'>
              {t('Switch to JSON mode for complex batch edits')}
            </div>
          )}
          <div className='text-muted-foreground text-xs'>
            {t(
              'Percent fields are shown as %, amount fields are shown in yuan with two decimals.'
            )}
          </div>
        </div>
        {!props.readOnly && (
          <Button variant='outline' size='sm' onClick={addItem}>
            {t('Add Rule')}
          </Button>
        )}
      </div>

      {parsed.error ? (
        <div className='text-destructive border-destructive/30 bg-destructive/10 rounded-lg border p-3 text-sm'>
          {t('Invalid JSON')}: {parsed.error}
        </div>
      ) : items.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm'>
          {t(
            'This rule array is empty and will be submitted as an empty array.'
          )}
        </div>
      ) : (
        <RuleTable
          rows={items.map((item, index) => ({ item, index }))}
          readOnly={props.readOnly}
          onChange={updateItem}
          onRemove={removeItem}
        />
      )}
    </div>
  )
}

export function RuleLevelGroupedEditor(props: {
  sections: {
    title: string
    field: string
    value?: string
    description?: string
    readOnly?: boolean
    onChange: (value: string) => void
  }[]
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const levels = [1, 2]

  const parseSection = (field: string) =>
    parseRuleArray(
      props.sections.find((section) => section.field === field)?.value
    )

  const writeItems = (field: string, items: RuleRecord[]) => {
    if (props.readOnly) return
    const section = props.sections.find((item) => item.field === field)
    section?.onChange(stringifyRuleArray(items))
  }

  const updateItem = (
    field: string,
    itemIndex: number,
    key: string,
    value: string
  ) => {
    if (props.readOnly) return
    const parsed = parseSection(field)
    const next = parsed.items.map((item) => ({ ...item }))
    next[itemIndex][key] = coerceRuleFieldValue(
      key,
      value,
      next[itemIndex][key]
    )
    writeItems(field, next)
  }

  const addItem = (field: string, level: number) => {
    if (props.readOnly) return
    const parsed = parseSection(field)
    const template = parsed.items.find(
      (item) => Number(item.affiliate_level) === level
    ) ||
      parsed.items[0] || { affiliate_level: level }
    const nextItem = Object.fromEntries(
      Object.entries(template).map(([key, value]) => [
        key,
        key === 'affiliate_level' ? level : emptyValueLike(value),
      ])
    ) as RuleRecord
    nextItem.affiliate_level = level
    writeItems(field, [...parsed.items, nextItem])
  }

  const removeItem = (field: string, itemIndex: number) => {
    if (props.readOnly) return
    const parsed = parseSection(field)
    writeItems(
      field,
      parsed.items.filter((_, index) => index !== itemIndex)
    )
  }

  return (
    <div className='rounded-xl border p-3'>
      <div className='mb-3 space-y-1'>
        <div className='font-medium'>
          {t('Rules grouped by affiliate level')}
        </div>
        <div className='text-muted-foreground text-xs'>
          {t(
            'Each column groups all rule types for one affiliate level. Switch to JSON mode for complex batch edits.'
          )}
        </div>
        <div className='text-muted-foreground text-xs'>
          {t(
            'Percent fields are shown as %, amount fields are shown in yuan with two decimals.'
          )}
        </div>
      </div>

      <div className='grid gap-3 xl:grid-cols-2'>
        {levels.map((level) => (
          <div key={level} className='bg-muted/20 rounded-xl border p-3'>
            <div className='mb-3 font-medium'>
              {getRuleLevelTitle(level, t)}
            </div>
            <div className='space-y-3'>
              {props.sections.map((section) => {
                const parsed = parseRuleArray(section.value)
                const kpiTierOptions = getKPITierCodeOptions(
                  parseSection('kpiTiersJson').items,
                  level
                )
                const items = parsed.items
                  .map((item, index) => ({ item, index }))
                  .filter(
                    ({ item }) => Number(item.affiliate_level || 0) === level
                  )

                return (
                  <div
                    key={section.field}
                    className='bg-background rounded-xl border p-3'
                  >
                    <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
                      <div>
                        <div className='text-sm font-medium'>
                          {section.title}
                        </div>
                        {section.description ? (
                          <div className='text-muted-foreground text-xs'>
                            {section.description}
                          </div>
                        ) : null}
                      </div>
                      {!props.readOnly && !section.readOnly && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => addItem(section.field, level)}
                        >
                          {t('Add Rule')}
                        </Button>
                      )}
                    </div>

                    {parsed.error ? (
                      <div className='text-destructive border-destructive/30 bg-destructive/10 rounded-lg border p-3 text-sm'>
                        {t('Invalid JSON')}: {parsed.error}
                      </div>
                    ) : items.length === 0 ? (
                      <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm'>
                        {t('This level has no rules for this rule type.')}
                      </div>
                    ) : (
                      <RuleTable
                        rows={items}
                        hiddenKeys={['affiliate_level']}
                        fieldOptions={{ kpi_tier_code: kpiTierOptions }}
                        readOnly={props.readOnly || section.readOnly}
                        onChange={(index, key, value) =>
                          updateItem(section.field, index, key, value)
                        }
                        onRemove={(index) => removeItem(section.field, index)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const __ruleArrayEditorTestUtils = {
  coerceRuleFieldValue,
  getDisplayValue,
  getKPITierCodeOptions,
  getRuleFieldLabel,
  getRuleFieldOptions,
  getRuleTableColumns,
}
