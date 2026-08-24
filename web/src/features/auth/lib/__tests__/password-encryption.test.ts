import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  clearPasswordEncryptionCache,
  encryptPassword,
  getPasswordEncryptionKey,
} from '../password-encryption'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('node-forge', () => ({
  pki: { publicKeyFromPem: () => ({ encrypt: () => 'binary' }) },
  util: { encode64: () => 'Zm9yZ2U=' },
  md: { sha256: { create: () => ({}) } },
}))

const key = {
  kid: 'kid1',
  public_key: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----',
}

beforeEach(() => {
  clearPasswordEncryptionCache()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getPasswordEncryptionKey', () => {
  test('fetches and caches the key', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: key } })

    const first = await getPasswordEncryptionKey()
    const second = await getPasswordEncryptionKey()

    expect(first).toEqual(key)
    expect(second).toEqual(key)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  test('rejects a malformed key response', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: null },
    })
    await expect(getPasswordEncryptionKey()).rejects.toThrow(
      'Failed to load password encryption key'
    )
  })
})

describe('encryptPassword', () => {
  test('uses Web Crypto when available', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: key } })
    const fakeSubtle = {
      importKey: vi.fn(async () => ({})),
      encrypt: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    }
    const fakeCrypto = { subtle: fakeSubtle } as unknown as Crypto
    vi.stubGlobal('crypto', fakeCrypto)

    const result = await encryptPassword('password')

    expect(result).toEqual({
      password_encrypted: 'AQID',
      encryption_key_id: 'kid1',
    })
    expect(fakeSubtle.importKey).toHaveBeenCalledTimes(1)
    expect(fakeSubtle.encrypt).toHaveBeenCalledTimes(1)
  })

  test('falls back to node-forge when Web Crypto is unavailable', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: key } })
    vi.stubGlobal('crypto', {} as Crypto)

    const result = await encryptPassword('password')

    expect(result).toEqual({
      password_encrypted: 'Zm9yZ2U=',
      encryption_key_id: 'kid1',
    })
  })
})
