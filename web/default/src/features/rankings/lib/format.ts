// ----------------------------------------------------------------------------
// Rankings formatting helpers
// ----------------------------------------------------------------------------

/** Format a token count as `1.2B`, `42M`, `980K`, or `512`. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000_000_000)
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`
  if (value >= 1_000)
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return value.toLocaleString()
}

/** Format a 0..1 share as a percentage with two decimals. */
export function formatShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%'
  if (share < 0.001) return '<0.1%'
  return `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`
}

/** Format a release date like `Oct 12, 2025`. */
export function formatReleaseDate(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return iso
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
