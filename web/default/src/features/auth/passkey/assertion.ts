export const PASSKEY_LAST_RP_ID_KEY = 'passkey:last-successful-rp-id'

export function getLastSuccessfulPasskeyRPID(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(PASSKEY_LAST_RP_ID_KEY)
}

export function rememberSuccessfulPasskeyRPID(rpId: string | undefined): void {
  if (typeof window === 'undefined' || !rpId) return
  window.localStorage.setItem(PASSKEY_LAST_RP_ID_KEY, rpId)
}
