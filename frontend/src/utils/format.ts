/** Quota follows new-api semantics: 500_000 quota = $1. */
export const QUOTA_PER_DOLLAR = 500_000

export function formatQuota(quota: number, digits = 2): string {
  const dollars = quota / QUOTA_PER_DOLLAR
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatMoney(amount: number, digits = 2): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function formatTime(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Local calendar date as 'YYYY-MM-DD' (DateRangePicker's wire format),
 * offset in whole days from today.
 */
export function dateInputValue(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function relativeTime(epochSec: number, locale = 'zh-CN'): string {
  const diff = Math.floor(Date.now() / 1000) - epochSec
  const zh = locale.startsWith('zh')
  if (diff < 60) return zh ? '刚刚' : 'just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return zh ? `${m} 分钟前` : `${m}m ago`
  }
  if (diff < 86_400) {
    const h = Math.floor(diff / 3600)
    return zh ? `${h} 小时前` : `${h}h ago`
  }
  const days = Math.floor(diff / 86_400)
  if (days < 30) return zh ? `${days} 天前` : `${days}d ago`
  return formatDate(epochSec)
}

/** Price per 1M tokens, e.g. "$1.2500". null renders as "—" upstream. */
export function formatTokenPrice(value: number | undefined): string {
  if (value == null) return '—'
  return `$${value.toFixed(4)}`
}

/** Latency snapshot: "1.78s" (<10s) / "18.0s" (≥10s), matching the design. */
export function formatLatency(sec: number): string {
  return sec >= 10 ? `${sec.toFixed(1)}s` : `${sec.toFixed(2)}s`
}

/** Context window as a compact label: 1_000_000 → "1M", 128_000 → "128K". */
export function formatContext(tokens: number): string {
  if (tokens <= 0) return '—'
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}

/** Human byte size: 2_205_000 → "2.1 MB", 12_800 → "12.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

/** Video length: 5 → "5s", 75 → "1:15". */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function maskKey(key: string): string {
  const value = key.trim()
  if (!value) return ''
  if (value.length <= 4) return '•'.repeat(value.length)
  if (value.length <= 11) {
    const prefixLength = Math.min(3, Math.max(1, Math.floor(value.length / 3)))
    const suffixLength = Math.min(2, Math.max(1, Math.floor(value.length / 4)))
    return `${value.slice(0, prefixLength)}••••${value.slice(-suffixLength)}`
  }
  return `${value.slice(0, 6)}••••${value.slice(-4)}`
}

export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (score <= 2) return 1
  if (score <= 4) return 2
  return 3
}
