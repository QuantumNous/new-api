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
import { api } from '@/lib/api'

export interface PasswordEncryptionKey {
  kid: string
  public_key: string
}

export interface EncryptedPassword {
  password_encrypted: string
  encryption_key_id: string
}

const KEY_CACHE_TTL_MS = 60_000

let cachedKey: PasswordEncryptionKey | null = null
let cachedAt = 0

export async function getPasswordEncryptionKey(): Promise<PasswordEncryptionKey> {
  const now = Date.now()
  if (cachedKey && now - cachedAt < KEY_CACHE_TTL_MS) {
    return cachedKey
  }

  const res = await api.get<{ success: boolean; data?: PasswordEncryptionKey }>(
    '/api/user/login/encryption-key'
  )
  const key = res.data?.data
  if (!res.data?.success || !key?.public_key || !key.kid) {
    throw new Error('Failed to load password encryption key')
  }

  cachedKey = key
  cachedAt = now
  return key
}

export function clearPasswordEncryptionCache() {
  cachedKey = null
  cachedAt = 0
}

export async function encryptPassword(
  password: string
): Promise<EncryptedPassword> {
  const key = await getPasswordEncryptionKey()
  const ciphertext = await rsaOaepEncrypt(password, key.public_key)
  return {
    password_encrypted: ciphertext,
    encryption_key_id: key.kid,
  }
}

async function rsaOaepEncrypt(
  password: string,
  publicKeyPem: string
): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const ciphertext = await encryptWithWebCrypto(password, publicKeyPem)
    return arrayBufferToBase64(ciphertext)
  }
  return encryptWithForge(password, publicKeyPem)
}

async function encryptWithWebCrypto(
  password: string,
  publicKeyPem: string
): Promise<ArrayBuffer> {
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    throw new Error('Web Crypto is not available in this context')
  }
  const publicKey = await crypto.subtle.importKey(
    'spki',
    pemToDer(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
  return crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    new TextEncoder().encode(password)
  )
}

async function encryptWithForge(
  password: string,
  publicKeyPem: string
): Promise<string> {
  const forge = await import('node-forge')
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem)
  const encrypted = publicKey.encrypt(forge.util.encodeUtf8(password), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
  })
  return forge.util.encode64(encrypted)
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replaceAll(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
