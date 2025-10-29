import {
  useSystemConfigStore,
  DEFAULT_CURRENCY_CONFIG,
  type CurrencyConfig,
  type CurrencyDisplayType,
} from '@/stores/system-config-store'

export interface CurrencyFormatOptions {
  /** Fraction digits to use when |value| >= 1 */
  digitsLarge?: number
  /** Fraction digits to use when |value| < 1 */
  digitsSmall?: number
  /** Whether to abbreviate thousands with k suffix */
  abbreviate?: boolean
  /** Minimal absolute value to display when rounding would produce zero */
  minimumNonZero?: number
}

type DisplayMeta =
  | {
      kind: 'currency'
      symbol: string
      currencyCode: string
      exchangeRate: number
    }
  | {
      kind: 'custom'
      symbol: string
      exchangeRate: number
    }
  | {
      kind: 'tokens'
      /** Number of tokens per USD */
      quotaPerUnit: number
    }

const DEFAULT_FORMAT_OPTIONS: Required<CurrencyFormatOptions> = {
  digitsLarge: 2,
  digitsSmall: 4,
  abbreviate: true,
  minimumNonZero: 0,
}

const DISPLAY_TYPE_VALUES = ['USD', 'CNY', 'TOKENS', 'CUSTOM'] as const
type DisplayTypeLiteral = (typeof DISPLAY_TYPE_VALUES)[number]

export function isCurrencyDisplayType(
  value: unknown
): value is CurrencyDisplayType {
  return (
    typeof value === 'string' &&
    DISPLAY_TYPE_VALUES.includes(value as DisplayTypeLiteral)
  )
}

export function parseCurrencyDisplayType(
  value: unknown,
  fallback: CurrencyDisplayType = 'USD'
): CurrencyDisplayType {
  return isCurrencyDisplayType(value) ? value : fallback
}

function getConfig(): CurrencyConfig {
  const { config } = useSystemConfigStore.getState()
  const currency = config?.currency ?? DEFAULT_CURRENCY_CONFIG
  return {
    ...DEFAULT_CURRENCY_CONFIG,
    ...currency,
    quotaPerUnit:
      currency?.quotaPerUnit && currency.quotaPerUnit > 0
        ? currency.quotaPerUnit
        : DEFAULT_CURRENCY_CONFIG.quotaPerUnit,
    usdExchangeRate:
      currency?.usdExchangeRate && currency.usdExchangeRate > 0
        ? currency.usdExchangeRate
        : DEFAULT_CURRENCY_CONFIG.usdExchangeRate,
    customCurrencyExchangeRate:
      currency?.customCurrencyExchangeRate &&
      currency.customCurrencyExchangeRate > 0
        ? currency.customCurrencyExchangeRate
        : DEFAULT_CURRENCY_CONFIG.customCurrencyExchangeRate,
    customCurrencySymbol:
      currency?.customCurrencySymbol?.trim() ||
      DEFAULT_CURRENCY_CONFIG.customCurrencySymbol,
  }
}

function getDisplayMeta(config: CurrencyConfig): DisplayMeta {
  switch (config.quotaDisplayType) {
    case 'CNY':
      return {
        kind: 'currency',
        symbol: '¥',
        currencyCode: 'CNY',
        exchangeRate: config.usdExchangeRate,
      }
    case 'CUSTOM':
      return {
        kind: 'custom',
        symbol: config.customCurrencySymbol,
        exchangeRate: config.customCurrencyExchangeRate,
      }
    case 'TOKENS':
      return {
        kind: 'tokens',
        quotaPerUnit: config.quotaPerUnit,
      }
    case 'USD':
    default:
      return {
        kind: 'currency',
        symbol: '$',
        currencyCode: 'USD',
        exchangeRate: 1,
      }
  }
}

function getBillingDisplayMeta(config: CurrencyConfig): DisplayMeta {
  const meta = getDisplayMeta(config)
  if (meta.kind === 'tokens') {
    return {
      kind: 'currency',
      symbol: '$',
      currencyCode: 'USD',
      exchangeRate: 1,
    }
  }
  return meta
}

function mergeOptions(
  options?: CurrencyFormatOptions
): Required<CurrencyFormatOptions> {
  if (!options) return DEFAULT_FORMAT_OPTIONS
  return {
    digitsLarge: options.digitsLarge ?? DEFAULT_FORMAT_OPTIONS.digitsLarge,
    digitsSmall: options.digitsSmall ?? DEFAULT_FORMAT_OPTIONS.digitsSmall,
    abbreviate: options.abbreviate ?? DEFAULT_FORMAT_OPTIONS.abbreviate,
    minimumNonZero:
      options.minimumNonZero ?? DEFAULT_FORMAT_OPTIONS.minimumNonZero,
  }
}

function removeTrailingZeros(str: string): string {
  if (!str.includes('.')) return str
  return str.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '')
}

function formatNumberWithSuffix(
  value: number,
  digitsLarge: number,
  digitsSmall: number,
  abbreviate: boolean
): string {
  const abs = Math.abs(value)
  if (abbreviate && abs >= 1000) {
    const result = value / 1000
    return removeTrailingZeros(result.toFixed(1)) + 'k'
  }

  const digits = abs >= 1 ? digitsLarge : digitsSmall
  return removeTrailingZeros(value.toFixed(digits))
}

function adjustForMinimum(
  value: number,
  digits: number,
  minimumNonZero: number
): number {
  if (value === 0) return value

  const threshold = minimumNonZero > 0 ? minimumNonZero : Math.pow(10, -digits)
  const abs = Math.abs(value)
  if (abs > 0 && abs < threshold) {
    return value > 0 ? threshold : -threshold
  }
  return value
}

function formatCurrencyValue(
  value: number,
  options: Required<CurrencyFormatOptions>,
  meta: DisplayMeta
): string {
  if (meta.kind === 'tokens') {
    return formatNumberWithSuffix(
      value,
      options.digitsLarge,
      options.digitsSmall,
      options.abbreviate
    )
  }

  const digits =
    Math.abs(value) >= 1 ? options.digitsLarge : options.digitsSmall
  const adjustedValue = adjustForMinimum(value, digits, options.minimumNonZero)

  if (meta.kind === 'currency') {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: meta.currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(adjustedValue)
    return formatted
  }

  const decimal = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(adjustedValue)

  return `${meta.symbol}${decimal}`
}

/**
 * Return current currency configuration along with derived display metadata.
 */
export function getCurrencyDisplay() {
  const config = getConfig()
  const meta = getDisplayMeta(config)
  return { config, meta }
}

/**
 * Format a given USD amount using the admin-configured display currency.
 * When quota display type is TOKENS, this returns the equivalent token amount.
 */
export function formatCurrencyFromUSD(
  amountUSD: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amountUSD == null || Number.isNaN(amountUSD)) return '-'

  const { config, meta } = getCurrencyDisplay()
  const merged = mergeOptions(options)

  if (!config.displayInCurrency || meta.kind === 'tokens') {
    const tokens = amountUSD * config.quotaPerUnit
    return formatNumberWithSuffix(
      tokens,
      meta.kind === 'tokens' ? 0 : merged.digitsLarge,
      merged.digitsSmall,
      merged.abbreviate
    )
  }

  const value =
    meta.kind === 'currency'
      ? amountUSD * meta.exchangeRate
      : amountUSD * meta.exchangeRate

  return formatCurrencyValue(value, merged, meta)
}

/**
 * Format billing currency amounts from USD without ever falling back to quota units.
 * Used by payment surfaces to always display real monetary values.
 */
export function formatBillingCurrencyFromUSD(
  amountUSD: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amountUSD == null || Number.isNaN(amountUSD)) return '-'

  const { config } = getCurrencyDisplay()
  const meta = getBillingDisplayMeta(config)
  const merged = mergeOptions(options)
  const value =
    meta.kind === 'currency' || meta.kind === 'custom'
      ? amountUSD * meta.exchangeRate
      : amountUSD

  return formatCurrencyValue(value, merged, meta)
}

/**
 * Format quota units using the configured currency presentation.
 */
export function formatQuotaWithCurrency(
  quota: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (quota == null || Number.isNaN(quota)) return '-'

  const { config } = getCurrencyDisplay()
  const amountUSD = quota / config.quotaPerUnit
  return formatCurrencyFromUSD(amountUSD, options)
}

/**
 * Helper to expose the current display currency label for UI copy.
 */
export function getCurrencyLabel(): string {
  const { config, meta } = getCurrencyDisplay()

  if (!config.displayInCurrency || meta.kind === 'tokens') {
    return 'Tokens'
  }

  switch (config.quotaDisplayType) {
    case 'CNY':
      return 'CNY'
    case 'CUSTOM':
      return meta.kind === 'custom' ? meta.symbol : 'Custom'
    case 'USD':
    default:
      return 'USD'
  }
}

export function isCurrencyDisplayEnabled(): boolean {
  const { config, meta } = getCurrencyDisplay()
  return config.displayInCurrency && meta.kind !== 'tokens'
}
