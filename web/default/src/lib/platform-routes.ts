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
export const PLATFORM_ROUTES = {
  portal: '/',
  chat: '/chat',
  console: '/console',
  consoleDashboard: '/console/dashboard/overview',
  admin: '/admin',
  adminHome: '/admin/channels',
  adminSystemSettings: '/admin/system-settings/site/system-info',
} as const

type PlatformLocation = {
  pathname: string
}

export function getLegacyRedirectPath(
  location: PlatformLocation,
  legacyPrefix: string,
  targetPrefix: string
) {
  if (location.pathname === legacyPrefix) {
    return targetPrefix
  }

  if (location.pathname.startsWith(`${legacyPrefix}/`)) {
    return `${targetPrefix}${location.pathname.slice(legacyPrefix.length)}`
  }

  return targetPrefix
}
