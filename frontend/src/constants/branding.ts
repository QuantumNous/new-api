/**
 * Frontend-local brand identity.
 *
 * The logo is imported as a module asset so Vite fingerprints it and prefixes
 * the configured `base` (`/next/`). A bare `/logo.png` string would resolve
 * against the server root, where `web/dist` (the React frontend) is served —
 * i.e. this frontend would render the other frontend's logo.
 */
import brandLogoUrl from '@/assets/brand/logo.png'

export const BRAND_LOGO_PATH: string = brandLogoUrl

/** Fallback product name used before `/api/status` reports `system_name`. */
export const BRAND_NAME = 'Ren2Hub'
