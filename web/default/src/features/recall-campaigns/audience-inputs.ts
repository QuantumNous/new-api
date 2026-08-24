import type { RecallAudienceUserOption } from './types'

const recallLocalDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const recallSpecifiedEmailLocalPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/
const recallSpecifiedEmailDomainLabelPattern =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function recallUnixToLocalDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return ''

  return [
    date.getFullYear(),
    '-',
    padDatePart(date.getMonth() + 1),
    '-',
    padDatePart(date.getDate()),
    'T',
    padDatePart(date.getHours()),
    ':',
    padDatePart(date.getMinutes()),
  ].join('')
}

export function recallLocalDateTimeToUnix(value: string): number {
  const trimmed = value.trim()
  if (!trimmed || !recallLocalDateTimePattern.test(trimmed)) return 0

  const timestamp = new Date(trimmed).getTime()
  if (!Number.isFinite(timestamp)) return 0

  const unix = Math.floor(timestamp / 60_000) * 60
  if (recallUnixToLocalDateTime(unix) !== trimmed) return 0

  return unix
}

export function isRecallSpecifiedEmail(value: string): boolean {
  const email = value.trim().toLowerCase()
  if (!email || /\s/.test(email)) return false

  const parts = email.split('@')
  if (parts.length !== 2) return false

  const [local, domain] = parts
  if (!local || !domain || !domain.includes('.')) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false
  }
  if (!recallSpecifiedEmailLocalPattern.test(local)) return false
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false
  }

  const labels = domain.split('.')
  return labels.every((label) =>
    recallSpecifiedEmailDomainLabelPattern.test(label)
  )
}

export function parseRecallSpecifiedEmails(value: string): {
  emails: string[]
  invalid: string[]
} {
  const emails: string[] = []
  const invalid: string[] = []
  const seenEmails = new Set<string>()
  const seenInvalid = new Set<string>()

  for (const token of value.split(/[,\r\n]+/)) {
    const normalized = token.trim().toLowerCase()
    if (!normalized) continue

    if (!isRecallSpecifiedEmail(normalized)) {
      if (!seenInvalid.has(normalized)) {
        seenInvalid.add(normalized)
        invalid.push(normalized)
      }
      continue
    }

    if (!seenEmails.has(normalized)) {
      seenEmails.add(normalized)
      emails.push(normalized)
    }
  }

  return { emails, invalid }
}

export function mergeRecallAudienceUserOptions(
  selected: RecallAudienceUserOption[],
  search: RecallAudienceUserOption[]
): RecallAudienceUserOption[] {
  const seen = new Set<number>()
  const merged: RecallAudienceUserOption[] = []

  for (const option of selected) {
    if (seen.has(option.id)) continue
    seen.add(option.id)
    merged.push(option)
  }

  for (const option of search) {
    if (seen.has(option.id)) continue
    seen.add(option.id)
    merged.push(option)
  }

  return merged
}
