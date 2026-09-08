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
import {
  AxiosError,
  isAxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from 'axios'
import { t } from 'i18next'

export const NON_JSON_RESPONSE = 'ERR_NON_JSON_RESPONSE'
export const NON_JSON_MESSAGE =
  'The service is temporarily unavailable or returned invalid data. Check task history before resubmitting image requests.'

function validateApiResponse(response: AxiosResponse): AxiosResponse {
  const responseType = response.config.responseType
  if (responseType === 'text' || responseType === 'stream') return response
  if (response.status === 204 || response.config.method === 'head') {
    return response
  }

  const contentType = String(
    response.headers['content-type'] || ''
  ).toLowerCase()
  const html =
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml')
  const expectsJson = !responseType || responseType === 'json'
  // Axios silently leaves malformed JSON as a string. Our JSON APIs return
  // objects/arrays; an HTML/text fallback must not reach application code.
  if (
    !html &&
    (!expectsJson ||
      (typeof response.data !== 'string' && response.data !== undefined))
  ) {
    return response
  }

  const message = t(NON_JSON_MESSAGE)
  const sanitized = {
    ...response,
    data: { code: 'GATEWAY_NON_JSON', message },
  }
  throw new AxiosError(
    message,
    NON_JSON_RESPONSE,
    response.config,
    undefined,
    sanitized
  )
}

export function installJsonResponseGuard(client: AxiosInstance): void {
  client.interceptors.response.use(validateApiResponse, (error: unknown) => {
    if (isAxiosError(error) && error.response) {
      validateApiResponse(error.response)
    }
    throw error
  })
}
