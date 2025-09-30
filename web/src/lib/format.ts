export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value as number
  )
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value as number)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format((value as number) / 100)
}

export function formatCurrencyUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value as number)
}
