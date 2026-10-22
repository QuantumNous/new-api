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

import { normalizeConnectIssueReasonCode } from './lib/connect'

export type IssuedConnectCode = {
  code: string
  origin: string
  expiresAt?: number
  ttlSeconds?: number
}

export class DesktopConnectIssueError extends Error {
  reasonCode: string
  httpStatus: number

  constructor(reasonCode: string, httpStatus = 0) {
    super(reasonCode)
    this.name = 'DesktopConnectIssueError'
    this.reasonCode = reasonCode
    this.httpStatus = httpStatus
  }
}

type IssueEnvelope = {
  success?: boolean
  code?: string
  data?: {
    code?: string
    origin?: string
    expiresAt?: number
    ttlSeconds?: number
  }
}

export async function issueDesktopConnectCode(
  origin: string
): Promise<IssuedConnectCode> {
  try {
    const response = await api.post<IssueEnvelope>(
      '/api/desktop/v2/connect-codes',
      { origin },
      {
        skipBusinessError: true,
        skipErrorHandler: true,
        skipAuthRefresh: true,
      }
    )
    const body = response.data
    if (!body || typeof body !== 'object' || body.success !== true) {
      throw new DesktopConnectIssueError(
        normalizeConnectIssueReasonCode(body?.code, response.status),
        response.status
      )
    }
    const data = body.data
    if (
      !data ||
      typeof data.code !== 'string' ||
      !data.code ||
      typeof data.origin !== 'string' ||
      !data.origin
    ) {
      throw new DesktopConnectIssueError(
        'issue_invalid_response',
        response.status
      )
    }
    return {
      code: data.code,
      origin: data.origin,
      expiresAt: data.expiresAt,
      ttlSeconds: data.ttlSeconds,
    }
  } catch (error) {
    if (error instanceof DesktopConnectIssueError) throw error
    const axiosLike = error as {
      response?: { status?: number; data?: { code?: string } }
    }
    const status = axiosLike.response?.status ?? 0
    const code = axiosLike.response?.data?.code
    throw new DesktopConnectIssueError(
      normalizeConnectIssueReasonCode(code, status),
      status
    )
  }
}
