export function normalizeDeploymentStatus(status: unknown) {
  return typeof status === 'string' ? status.trim().toLowerCase() : ''
}

export function formatRemainingMinutes(mins: unknown) {
  const n =
    typeof mins === 'string'
      ? Number(mins)
      : typeof mins === 'number'
        ? mins
        : NaN
  if (!Number.isFinite(n)) return null

  const total = Math.max(0, Math.round(n))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const minutes = total % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (parts.length === 0 || minutes > 0) parts.push(`${minutes}m`)
  return parts.join(' ')
}
