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
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { drawingErrorMessage } from '@/features/ai-drawing/api'
import { useAuthStore } from '@/stores/auth-store'

import { api } from './http-client'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset('idle')
})

function respond(status: number, data: unknown, contentType: string) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    const response = {
      config,
      status,
      statusText: String(status),
      headers: new AxiosHeaders({ 'content-type': contentType }),
      data,
    }
    if (status >= 400) {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response
      )
    }
    return response
  })
  api.defaults.adapter = adapter
  return adapter
}

describe('JSON API response boundary', () => {
  test('rejects a Cloudflare HTML error without retrying image submission', async () => {
    const adapter = respond(
      530,
      '<!doctype html><title>PRIVATE_ERROR_PAGE</title>',
      'text/html'
    )
    const error = await api
      .post('/pg/drawing/batches', {}, { skipErrorHandler: true })
      .catch((reason: unknown) => reason)
    expect(error).toMatchObject({
      code: 'ERR_NON_JSON_RESPONSE',
      response: { status: 530 },
    })
    expect(drawingErrorMessage(error, 'fallback')).toMatch(
      /temporarily unavailable|暂时不可用/
    )
    expect(JSON.stringify(error)).not.toContain('PRIVATE_ERROR_PAGE')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  test('rejects HTML returned with HTTP 200 instead of treating it as application data', async () => {
    respond(200, '<html>Gateway</html>', 'text/html')
    await expect(
      api.get('/api/status', { skipErrorHandler: true })
    ).rejects.toMatchObject({ code: 'ERR_NON_JSON_RESPONSE' })
  })

  test('rejects truncated JSON without leaking the raw parse exception', async () => {
    respond(200, '{"data":', 'application/json')
    await expect(
      api.get('/api/status', { skipErrorHandler: true })
    ).rejects.toMatchObject({ code: 'ERR_NON_JSON_RESPONSE' })
  })

  test('preserves valid JSON image data and usage', async () => {
    respond(
      200,
      {
        data: [{ b64_json: 'aW1hZ2U=', size: '120x80' }],
        usage: { total_tokens: 20 },
      },
      'application/json'
    )
    const response = await api.post('/v1/images/generations', {})
    expect(response.data).toEqual({
      data: [{ b64_json: 'aW1hZ2U=', size: '120x80' }],
      usage: { total_tokens: 20 },
    })
  })

  test('preserves JSON delivery failures and their no-retry instruction', async () => {
    const adapter = respond(
      424,
      {
        error: {
          code: 'image_delivery_failed',
          message: 'Image delivery failed',
        },
      },
      'application/json'
    )
    await expect(
      api.post('/v1/images/generations', {}, { skipErrorHandler: true })
    ).rejects.toMatchObject({
      response: {
        status: 424,
        data: { error: { code: 'image_delivery_failed' } },
      },
    })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  test('leaves image blobs and empty HTTP 204 responses intact', async () => {
    const blob = new Blob(['image'], { type: 'image/png' })
    respond(200, blob, 'image/png')
    expect(
      (await api.get('/pg/drawing/images/a', { responseType: 'blob' })).data
    ).toBe(blob)
    respond(204, '', '')
    expect((await api.delete('/pg/drawing/templates/a')).status).toBe(204)
  })

  test('rejects an HTML download disguised as an image blob', async () => {
    respond(
      200,
      new Blob(['<html>Gateway</html>'], { type: 'text/html' }),
      'text/html'
    )
    await expect(
      api.get('/pg/drawing/images/a', {
        responseType: 'blob',
        skipErrorHandler: true,
      })
    ).rejects.toMatchObject({ code: 'ERR_NON_JSON_RESPONSE' })
  })

  test('does not refresh credentials for an HTML 401 from a gateway', async () => {
    const adapter = respond(401, '<html>Access gateway</html>', 'text/html')
    await expect(
      api.post('/pg/drawing/batches', {}, { skipErrorHandler: true })
    ).rejects.toMatchObject({ code: 'ERR_NON_JSON_RESPONSE' })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
