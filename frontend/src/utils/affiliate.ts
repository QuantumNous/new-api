const AFFILIATE_STORAGE_KEY = 'ren2hub.affiliate-attribution.v1'
const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface StoredAffiliateAttribution {
  code: string
  expiresAt: number
}

export function getAffiliateAttribution(): string {
  try {
    const raw = localStorage.getItem(AFFILIATE_STORAGE_KEY)
    if (!raw) return ''
    const value = JSON.parse(raw) as Partial<StoredAffiliateAttribution>
    if (
      typeof value.code !== 'string' ||
      !value.code ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(AFFILIATE_STORAGE_KEY)
      return ''
    }
    return value.code
  } catch {
    localStorage.removeItem(AFFILIATE_STORAGE_KEY)
    return ''
  }
}

export function storeAffiliateAttribution(code: string): void {
  const normalized = code.trim()
  if (!normalized) return
  const value: StoredAffiliateAttribution = {
    code: normalized,
    expiresAt: Date.now() + AFFILIATE_TTL_MS,
  }
  localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify(value))
}

export function clearAffiliateAttribution(): void {
  localStorage.removeItem(AFFILIATE_STORAGE_KEY)
}
