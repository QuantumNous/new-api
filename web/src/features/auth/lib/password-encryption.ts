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
import { t } from 'i18next'

import { api } from '@/lib/api'

interface PasswordEncryptionKey {
  kid: string
  public_key: string
}

export interface EncryptedPassword {
  password_encrypted: string
  encryption_key_id: string
}

const KEY_CACHE_TTL_MS = 5 * 60_000

let cachedKey: PasswordEncryptionKey | null = null
let cachedAt = 0

export function clearPasswordEncryptionCache(): void {
  cachedKey = null
  cachedAt = 0
}

export async function encryptPassword(
  password: string
): Promise<EncryptedPassword> {
  try {
    const key = await getPasswordEncryptionKey()
    const ciphertext = await rsaOaepEncrypt(password, key.public_key)
    return {
      password_encrypted: ciphertext,
      encryption_key_id: key.kid,
    }
  } catch (error: unknown) {
    clearPasswordEncryptionCache()
    throw new Error(t('Login failed'), { cause: error })
  }
}

async function getPasswordEncryptionKey(): Promise<PasswordEncryptionKey> {
  const now = Date.now()
  if (cachedKey && now - cachedAt < KEY_CACHE_TTL_MS) {
    return cachedKey
  }

  const response = await api.get<{
    success: boolean
    data?: PasswordEncryptionKey
  }>('/api/user/login/encryption-key')
  const key = response.data?.data
  if (!response.data?.success || !key?.kid || !key.public_key) {
    throw new Error('Password encryption key is unavailable')
  }
  cachedKey = key
  cachedAt = now
  return key
}

async function rsaOaepEncrypt(
  password: string,
  publicKeyPEM: string
): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    try {
      const publicKey = await globalThis.crypto.subtle.importKey(
        'spki',
        pemToDER(publicKeyPEM),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      )
      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        new TextEncoder().encode(password)
      )
      return arrayBufferToBase64(ciphertext)
    } catch {
      // Older implementations may expose SubtleCrypto without supporting the
      // required RSA-OAEP parameters; the HTTP-compatible fallback handles it.
    }
  }

  // Web Crypto is restricted to secure contexts in browsers. Lazy-loading
  // forge keeps the normal HTTPS bundle small while supporting HTTP intranets.
  const forge = await import('node-forge')
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPEM)
  const ciphertext = publicKey.encrypt(
    forge.util.encodeUtf8(password),
    'RSA-OAEP',
    { md: forge.md.sha256.create() }
  )
  return forge.util.encode64(ciphertext)
}

function pemToDER(pem: string): ArrayBuffer {
  const body = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replaceAll(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
