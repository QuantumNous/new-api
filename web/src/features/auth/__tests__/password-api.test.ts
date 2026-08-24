import { beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { login, register } from '../api'
import {
  clearPasswordEncryptionCache,
  encryptPassword,
} from '../lib/password-encryption'

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), get: vi.fn() },
  refreshAuthentication: vi.fn(),
  isAuthBundle: vi.fn(),
}))

vi.mock('../lib/password-encryption', () => ({
  encryptPassword: vi.fn(),
  clearPasswordEncryptionCache: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('login sends encrypted password', () => {
  test('encrypts the password and omits plaintext from the request body', async () => {
    vi.mocked(encryptPassword).mockResolvedValue({
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })

    await login({
      username: 'alice',
      password: 'plain-secret',
      turnstile: 'tk',
    })

    expect(encryptPassword).toHaveBeenCalledWith('plain-secret')
    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/user/login?turnstile=tk')
    expect(body).toEqual({
      username: 'alice',
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
  })

  test('clears the cached encryption key when the login fails', async () => {
    vi.mocked(encryptPassword).mockResolvedValue({
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: false } })

    await login({ username: 'alice', password: 'plain-secret' })

    expect(clearPasswordEncryptionCache).toHaveBeenCalledTimes(1)
  })
})

describe('register sends encrypted password', () => {
  test('encrypts the password and omits plaintext from the request body', async () => {
    vi.mocked(encryptPassword).mockResolvedValue({
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })

    await register({
      username: 'bob',
      password: 'plain-secret',
      email: 'bob@example.com',
      verification_code: '123456',
      aff_code: 'AFF',
      turnstile: 'tk',
    })

    expect(encryptPassword).toHaveBeenCalledWith('plain-secret')
    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/user/register')
    expect(body).toEqual({
      username: 'bob',
      email: 'bob@example.com',
      verification_code: '123456',
      aff_code: 'AFF',
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
    expect(config).toEqual({ params: { turnstile: 'tk' } })
  })

  test('clears the cached encryption key when the register fails', async () => {
    vi.mocked(encryptPassword).mockResolvedValue({
      password_encrypted: 'cipher',
      encryption_key_id: 'kid1',
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: false } })

    await register({ username: 'bob', password: 'plain-secret' })

    expect(clearPasswordEncryptionCache).toHaveBeenCalledTimes(1)
  })
})
