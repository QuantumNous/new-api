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

const forgeMocks = vi.hoisted(() => {
  const encrypt = vi.fn(() => 'binary')
  const encodeUtf8 = vi.fn((input: string) => `utf8:${input}`)
  const sha256Create = vi.fn(() => ({}))
  return { encrypt, encodeUtf8, sha256Create }
})

vi.mock('node-forge', () => ({
  pki: { publicKeyFromPem: () => ({ encrypt: forgeMocks.encrypt }) },
  util: { encode64: () => 'Zm9yZ2U=', encodeUtf8: forgeMocks.encodeUtf8 },
  md: { sha256: { create: forgeMocks.sha256Create } },
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
    expect(forgeMocks.encodeUtf8).toHaveBeenCalledWith('password')
    expect(forgeMocks.encrypt).toHaveBeenCalledWith(
      'utf8:password',
      'RSA-OAEP',
      expect.objectContaining({ md: expect.anything() })
    )
    expect(forgeMocks.sha256Create).toHaveBeenCalledTimes(1)
  })

  test('falls back to node-forge with UTF-8 encoded non-ASCII passwords', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: key } })
    vi.stubGlobal('crypto', {} as Crypto)

    const result = await encryptPassword('密码')

    expect(result).toEqual({
      password_encrypted: 'Zm9yZ2U=',
      encryption_key_id: 'kid1',
    })
    expect(forgeMocks.encodeUtf8).toHaveBeenCalledWith('密码')
    expect(forgeMocks.encrypt).toHaveBeenCalledWith(
      'utf8:密码',
      'RSA-OAEP',
      expect.objectContaining({ md: expect.anything() })
    )
  })
})
