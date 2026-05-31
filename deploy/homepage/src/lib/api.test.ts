import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ApiError, api, getAuthHeaders, saveAuth, clearAuth, hasAuthToken, type PaginatedData } from './api'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('getAuthHeaders', () => {
  it('returns empty object when no user id', () => {
    const headers = getAuthHeaders()
    expect(headers).toEqual({})
  })

  it('returns New-Api-User header with user id', () => {
    localStorage.setItem('vynex-user-id', '123')
    const headers = getAuthHeaders()
    expect(headers).toEqual({ 'New-Api-User': '123' })
  })

  it('includes Authorization header when token exists', () => {
    localStorage.setItem('vynex-user-id', '123')
    localStorage.setItem('vynex-access-token', 'test-token')
    const headers = getAuthHeaders()
    expect(headers).toEqual({
      'New-Api-User': '123',
      'Authorization': 'test-token'
    })
  })

  it('handles empty token string', () => {
    localStorage.setItem('vynex-user-id', '123')
    localStorage.setItem('vynex-access-token', '')
    const headers = getAuthHeaders()
    expect(headers).toEqual({
      'New-Api-User': '123'
    })
  })
})

describe('saveAuth', () => {
  it('saves token and user id to localStorage', () => {
    saveAuth('my-token', 456)
    expect(localStorage.getItem('vynex-access-token')).toBe('my-token')
    expect(localStorage.getItem('vynex-user-id')).toBe('456')
  })

  it('converts user id to string', () => {
    saveAuth('token', 789)
    expect(localStorage.getItem('vynex-user-id')).toBe('789')
    expect(typeof localStorage.getItem('vynex-user-id')).toBe('string')
  })
})

describe('clearAuth', () => {
  it('removes auth items from localStorage', () => {
    localStorage.setItem('vynex-access-token', 'token')
    localStorage.setItem('vynex-user-id', '123')
    clearAuth()
    expect(localStorage.getItem('vynex-access-token')).toBeNull()
    expect(localStorage.getItem('vynex-user-id')).toBeNull()
  })
})

describe('hasAuthToken', () => {
  it('returns false when no user id', () => {
    expect(hasAuthToken()).toBe(false)
  })

  it('returns true when user id exists', () => {
    localStorage.setItem('vynex-user-id', '123')
    expect(hasAuthToken()).toBe(true)
  })
})

describe('ApiError', () => {
  it('creates error with code and message', () => {
    const err = new ApiError(404, 'Not Found')
    expect(err.code).toBe(404)
    expect(err.message).toBe('Not Found')
    expect(err.data).toBeUndefined()
  })

  it('creates error with code, message, and data', () => {
    const data = { details: 'Resource not found' }
    const err = new ApiError(404, 'Not Found', data)
    expect(err.code).toBe(404)
    expect(err.message).toBe('Not Found')
    expect(err.data).toEqual(data)
  })
})

describe('api.get', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('makes GET request with params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { result: 'test' } })
    })

    const result = await api.get<{ result: string }>('/api/test', { page: 1, limit: 10 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/api/test')
    expect(callArgs[0]).toContain('page=1')
    expect(callArgs[0]).toContain('limit=10')
    expect(result).toEqual({ result: 'test' })
  })

  it('handles undefined params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: 'ok' })
    })

    await api.get('/api/test', { name: 'test', skip: undefined })
    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('name=test')
    expect(url).not.toContain('skip')
  })

  it('includes credentials and auth headers', async () => {
    localStorage.setItem('vynex-user-id', '123')
    localStorage.setItem('vynex-access-token', 'token123')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null })
    })

    await api.get('/api/test')
    const init = mockFetch.mock.calls[0][1]
    expect(init.credentials).toBe('include')
    expect(init.headers['New-Api-User']).toBe('123')
    expect(init.headers['Authorization']).toBe('token123')
  })

  it('throws ApiError on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: 'Unauthorized', data: { code: 401 } })
    })

    try {
      await api.get('/api/test')
      expect.fail('Should have thrown ApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      if (err instanceof ApiError) {
        expect(err.code).toBe(401)
        expect(err.message).toBe('Unauthorized')
      }
    }
  })

  it('throws ApiError when success is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: false, message: 'Error occurred' })
    })

    await expect(api.get('/api/test')).rejects.toThrow('Error occurred')
  })
})

describe('api.post', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('makes POST request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 123 } })
    })

    const body = { name: 'test', value: 42 }
    const result = await api.post<{ id: number }>('/api/create', body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(callArgs[1].body as string)).toEqual(body)
    expect(result).toEqual({ id: 123 })
  })

  it('handles undefined body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null })
    })

    await api.post('/api/create')
    const callArgs = mockFetch.mock.calls[0]
    // undefined body is not sent
    expect(callArgs[1].body).toBeUndefined()
  })
})

describe('api.put', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('makes PUT request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { updated: true } })
    })

    const body = { id: 1, status: 'active' }
    const result = await api.put<{ updated: boolean }>('/api/update', body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT')
    expect(result).toEqual({ updated: true })
  })
})

describe('api.del', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('makes DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { deleted: true } })
    })

    const result = await api.del<{ deleted: boolean }>('/api/items/1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
    expect(result).toEqual({ deleted: true })
  })
})
