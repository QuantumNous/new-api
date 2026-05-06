import { bytecolaBrandProfile } from './profiles/bytecola'
import type { BrandProfile } from './types'

const profiles: Record<string, BrandProfile> = {
  bytecola: bytecolaBrandProfile,
}

function getActiveProfileId() {
  return (import.meta.env.VITE_PUBLIC_BRAND_PROFILE || '').trim().toLowerCase()
}

export function getActiveBrandProfile(): BrandProfile | null {
  const profileId = getActiveProfileId()
  return profiles[profileId] || null
}

export function getDefaultSystemName() {
  return getActiveBrandProfile()?.systemName || 'New API'
}

export function getDefaultLogo() {
  return getActiveBrandProfile()?.defaultLogo || '/logo.png'
}

export function getDefaultFavicon() {
  return getActiveBrandProfile()?.meta.favicon || getDefaultLogo()
}

export function getDefaultAboutMarkdown() {
  return getActiveBrandProfile()?.defaultAboutMarkdown || ''
}

export function getDefaultFooterHtml() {
  return getActiveBrandProfile()?.defaultFooterHtml || ''
}
