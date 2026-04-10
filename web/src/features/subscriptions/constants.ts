import { type TFunction } from 'i18next'

// ============================================================================
// Duration Unit Options
// ============================================================================

export const DURATION_UNITS = [
  { value: 'year', labelKey: '年' },
  { value: 'month', labelKey: '月' },
  { value: 'day', labelKey: '日' },
  { value: 'hour', labelKey: '小时' },
  { value: 'custom', labelKey: '自定义(秒)' },
] as const

export const RESET_PERIODS = [
  { value: 'never', labelKey: '不重置' },
  { value: 'daily', labelKey: '每天' },
  { value: 'weekly', labelKey: '每周' },
  { value: 'monthly', labelKey: '每月' },
  { value: 'custom', labelKey: '自定义(秒)' },
] as const

export function getDurationUnitOptions(t: TFunction) {
  return DURATION_UNITS.map((u) => ({ value: u.value, label: t(u.labelKey) }))
}

export function getResetPeriodOptions(t: TFunction) {
  return RESET_PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))
}
