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
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i
const CHANNEL_CONN_CLIPBOARD_TYPE = 'newapi_channel_conn'

function getWindowOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function getWindowProtocol(): string {
  if (typeof window === 'undefined') return 'http:'
  return window.location.protocol
}

function toUrl(value: string): URL | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const withScheme = URL_SCHEME_PATTERN.test(trimmed)
    ? trimmed
    : trimmed.startsWith('//')
      ? `${getWindowProtocol()}${trimmed}`
      : `${getWindowProtocol()}//${trimmed}`

  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeServerAddress(value: string): string {
  const url = toUrl(value)
  if (!url) return stripTrailingSlashes(value.trim())

  const pathname =
    url.pathname === '/' ? '' : stripTrailingSlashes(url.pathname)
  return `${url.origin}${pathname}`
}

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function extractServerAddress(status: unknown): string {
  if (!status || typeof status !== 'object') return ''

  const record = status as Record<string, unknown>
  const data =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : undefined

  const candidates = [
    record.server_address,
    record.serverAddress,
    data?.server_address,
    data?.serverAddress,
  ]

  for (const candidate of candidates) {
    const value = getStringValue(candidate)
    if (value) return value
  }

  return ''
}

function getStoredServerAddress(): string {
  if (typeof window === 'undefined') return ''

  try {
    const raw = window.localStorage.getItem('status')
    if (!raw) return ''
    return extractServerAddress(JSON.parse(raw))
  } catch {
    return ''
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part))
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 169 && second === 254) ||
    (first === 192 && second === 168)
  )
}

function isNonPublicServerAddress(value: string): boolean {
  const url = toUrl(value)
  if (!url) return false

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:') ||
    isPrivateIpv4(hostname)
  )
}

export function getPublicServerAddress(configuredAddress?: string): string {
  const configured = configuredAddress?.trim() || getStoredServerAddress()
  const browserOrigin = getWindowOrigin()

  const normalizedConfigured = configured
    ? normalizeServerAddress(configured)
    : ''
  const normalizedOrigin = browserOrigin
    ? normalizeServerAddress(browserOrigin)
    : ''

  if (
    normalizedConfigured &&
    (!isNonPublicServerAddress(normalizedConfigured) ||
      isNonPublicServerAddress(normalizedOrigin))
  ) {
    return normalizedConfigured
  }

  return normalizedOrigin || normalizedConfigured
}

export function getPublicApiBaseUrl(configuredAddress?: string): string {
  const serverAddress = getPublicServerAddress(configuredAddress)
  if (!serverAddress) return ''
  return serverAddress.endsWith('/v1') ? serverAddress : `${serverAddress}/v1`
}

export function encodeChannelConnectionString(
  key: string,
  configuredAddress?: string
): string {
  return JSON.stringify({
    _type: CHANNEL_CONN_CLIPBOARD_TYPE,
    key,
    url: getPublicApiBaseUrl(configuredAddress),
  })
}
