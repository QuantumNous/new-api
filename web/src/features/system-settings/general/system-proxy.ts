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

const SUPPORTED_PROXY_PROTOCOLS = new Set([
  'http:',
  'https:',
  'socks5:',
  'socks5h:',
])

export function isOptionalProxyURL(value: string): boolean {
  const trimmedValue = value.trim()
  if (!trimmedValue) return true
  if (value !== trimmedValue) return false

  try {
    const parsedURL = new URL(trimmedValue)
    return (
      SUPPORTED_PROXY_PROTOCOLS.has(parsedURL.protocol) &&
      Boolean(parsedURL.hostname) &&
      parsedURL.port !== '0' &&
      (parsedURL.pathname === '' || parsedURL.pathname === '/') &&
      parsedURL.search === '' &&
      parsedURL.hash === ''
    )
  } catch {
    return false
  }
}
