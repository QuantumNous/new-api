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
export interface PlaygroundCryptoProvider {
  randomUUID?: () => string
  getRandomValues?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>
}

let fallbackSequence = 0

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function markAsVersion4(bytes: Uint8Array): Uint8Array {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytes
}

function fillFallbackBytes(bytes: Uint8Array): Uint8Array {
  const sequence = fallbackSequence++
  const timestamp = Date.now()

  for (let index = 0; index < bytes.length; index += 1) {
    const timeByte = Math.floor(timestamp / 2 ** ((index % 6) * 8))
    const sequenceByte = sequence >>> ((index % 4) * 8)
    const randomByte = Math.floor(Math.random() * 256)
    bytes[index] = timeByte ^ sequenceByte ^ randomByte ^ (index * 37)
  }

  return bytes
}

function getBrowserCrypto(): PlaygroundCryptoProvider {
  if (typeof globalThis.crypto === 'undefined') return {}

  return {
    randomUUID:
      typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
        : undefined,
    getRandomValues:
      typeof globalThis.crypto.getRandomValues === 'function'
        ? (bytes) => globalThis.crypto.getRandomValues(bytes)
        : undefined,
  }
}

export function createPlaygroundId(
  provider: PlaygroundCryptoProvider = getBrowserCrypto()
): string {
  if (provider.randomUUID) {
    try {
      return provider.randomUUID()
    } catch {
      // Fall through when randomUUID is unavailable in an insecure context.
    }
  }

  const bytes = new Uint8Array(16)
  if (provider.getRandomValues) {
    try {
      return formatUuid(markAsVersion4(provider.getRandomValues(bytes)))
    } catch {
      // A timestamp, counter, and Math.random still provide a unique local ID.
    }
  }

  return formatUuid(markAsVersion4(fillFallbackBytes(bytes)))
}
