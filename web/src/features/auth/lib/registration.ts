/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { SystemStatus } from '../types'
import { hasOAuthProviders } from './oauth'

export interface RegistrationAvailability {
  local: boolean
  oauth: boolean
}

/**
 * Resolve the OAuth provider's human registration page.
 *
 * Custom OAuth providers expose registration at `/register` on the
 * authorization server origin. Built-in providers do not share this
 * convention, so only custom providers are considered.
 */
export function getExternalOAuthRegistrationUrl(
  status: SystemStatus | null
): string | null {
  const providers = status?.custom_oauth_providers
  if (providers?.length !== 1) return null
  const hasBuiltInProvider = Boolean(
    status?.github_oauth ||
    status?.discord_oauth ||
    status?.oidc_enabled ||
    status?.linuxdo_oauth ||
    status?.telegram_oauth ||
    status?.wechat_login
  )
  if (hasBuiltInProvider) return null

  const provider = providers[0]
  if (!provider?.authorization_endpoint) return null

  try {
    const authorizationUrl = new URL(provider.authorization_endpoint)
    if (
      authorizationUrl.protocol !== 'https:' &&
      authorizationUrl.protocol !== 'http:'
    ) {
      return null
    }
    return new URL('/register', authorizationUrl.origin).toString()
  } catch {
    return null
  }
}

/**
 * Resolve which registration paths the sign-in and sign-up pages may expose.
 * Local registration remains hidden when an administrator disables it, while
 * OAuth registration stays available whenever global registration is enabled.
 */
export function getRegistrationAvailability(
  status: SystemStatus | null
): RegistrationAvailability {
  const globallyEnabled = status?.register_enabled !== false
  const oauthRegisterEnabled =
    status?.oauth_register_enabled ??
    status?.data?.oauth_register_enabled ??
    true

  return {
    local: globallyEnabled && status?.local_registration_disabled !== true,
    oauth: globallyEnabled && oauthRegisterEnabled && hasOAuthProviders(status),
  }
}
