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
import { JSEncrypt } from 'jsencrypt'

import { getStatus } from '@/lib/api'

// In-memory cache of the PEM public key fetched from /api/status. The key
// rarely changes (only on admin rotation), so we fetch once per session.
let cachedPublicKey: string | null = null
let cachedRequired: boolean = false
let fetchPromise: Promise<string | null> | null = null

interface StatusLike {
  password_encryption_public_key?: unknown
  password_encryption_required?: unknown
}

function readStatusFromLocalStorage(): StatusLike | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem('status')
    if (!saved) return null
    return JSON.parse(saved) as StatusLike
  } catch {
    return null
  }
}

async function loadPublicKey(): Promise<{ pem: string | null; required: boolean }> {
  // 1. Synchronous hit from in-memory cache.
  if (cachedPublicKey !== null) {
    return { pem: cachedPublicKey, required: cachedRequired }
  }
  // 2. Synchronous hit from localStorage (useStatus writes there).
  const fromStorage = readStatusFromLocalStorage()
  const pemFromStorage =
    typeof fromStorage?.password_encryption_public_key === 'string'
      ? fromStorage.password_encryption_public_key
      : null
  const requiredFromStorage =
    fromStorage?.password_encryption_required === true
  if (pemFromStorage) {
    cachedPublicKey = pemFromStorage
    cachedRequired = requiredFromStorage
    return { pem: cachedPublicKey, required: cachedRequired }
  }
  // 3. Fall back to a fresh fetch (cold start before useStatus populates).
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const status = (await getStatus()) as StatusLike | null
        const pem =
          typeof status?.password_encryption_public_key === 'string'
            ? status.password_encryption_public_key
            : null
        const required = status?.password_encryption_required === true
        if (pem) {
          cachedPublicKey = pem
          cachedRequired = required
        }
        return pem
      } catch {
        return null
      } finally {
        fetchPromise = null
      }
    })()
  }
  const pem = await fetchPromise
  return { pem, required: cachedRequired }
}

// For tests: inject a known public key without hitting the network.
export function __setPasswordEncryptionKeyForTesting(
  pem: string | null,
  required = false
): void {
  cachedPublicKey = pem
  cachedRequired = required
  fetchPromise = null
}

// isPasswordEncryptionRequired reports whether the backend currently rejects
// plaintext passwords. Read from cache; false until the first load.
export async function isPasswordEncryptionRequired(): Promise<boolean> {
  const { required } = await loadPublicKey()
  return required
}

// encryptPassword returns base64 RSA-PKCS1v15 ciphertext, or null when no
// public key is available. Callers decide whether to fall back to plaintext
// (migration period) or surface an error.
export async function encryptPassword(plaintext: string): Promise<string | null> {
  if (!plaintext) return null
  const { pem } = await loadPublicKey()
  if (!pem) return null
  const encrypt = new JSEncrypt()
  encrypt.setPublicKey(pem)
  const cipher = encrypt.encrypt(plaintext)
  if (typeof cipher !== 'string' || cipher === '') return null
  return cipher
}
