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
import { API } from './api';

const KEY_CACHE_TTL_MS = 5 * 60_000;

let cachedKey = null;
let cachedAt = 0;

export function clearPasswordEncryptionCache() {
  cachedKey = null;
  cachedAt = 0;
}

export async function encryptPassword(password) {
  try {
    const key = await getPasswordEncryptionKey();
    const ciphertext = await rsaOaepEncrypt(password, key.public_key);
    return {
      password_encrypted: ciphertext,
      encryption_key_id: key.kid,
    };
  } catch (error) {
    clearPasswordEncryptionCache();
    throw error;
  }
}

async function getPasswordEncryptionKey() {
  const now = Date.now();
  if (cachedKey && now - cachedAt < KEY_CACHE_TTL_MS) {
    return cachedKey;
  }

  const response = await API.get('/api/user/login/encryption-key');
  const key = response.data?.data;
  if (!response.data?.success || !key?.kid || !key.public_key) {
    throw new Error('Password encryption key is unavailable');
  }
  cachedKey = key;
  cachedAt = now;
  return key;
}

async function rsaOaepEncrypt(password, publicKeyPEM) {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    try {
      const publicKey = await globalThis.crypto.subtle.importKey(
        'spki',
        pemToDER(publicKeyPEM),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt'],
      );
      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        new TextEncoder().encode(password),
      );
      return arrayBufferToBase64(ciphertext);
    } catch {
      // Fallback to node-forge
    }
  }

  const forge = await import('node-forge');
  const forgeModule = forge.default ?? forge;
  const publicKey = forgeModule.pki.publicKeyFromPem(publicKeyPEM);
  const ciphertext = publicKey.encrypt(
    forgeModule.util.encodeUtf8(password),
    'RSA-OAEP',
    { md: forgeModule.md.sha256.create() },
  );
  return forgeModule.util.encode64(ciphertext);
}

function pemToDER(pem) {
  const body = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replaceAll(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
