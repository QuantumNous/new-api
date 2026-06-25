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
import type {
  ApiKeyFormData,
  ApiResponse,
  EnsureInitialApiKeyResponse,
} from '../types'
import {
  getApiKeyFormDefaultValues,
  transformFormDataToPayload,
} from './api-key-form'

export type DefaultApiKeyPayloadOptions = {
  name?: string
}

export type InitialApiKeyCreateResult =
  | { status: 'created'; consumeSearch: true; key: string }
  | { status: 'skipped-existing'; consumeSearch: true }
  | { status: 'load-failed'; consumeSearch: false; message?: string }
  | { status: 'create-failed'; consumeSearch: false; message?: string }

export type InitialApiKeyCreateDeps = {
  scopeKey: string
  ensureInitialKey: () => Promise<ApiResponse<EnsureInitialApiKeyResponse>>
}

let initialApiKeyCreateScopeKey: string | null = null
let initialApiKeyCreateInFlight: Promise<InitialApiKeyCreateResult> | null =
  null
let initialApiKeyCreateResult: InitialApiKeyCreateResult | null = null

export function buildDefaultApiKeyPayload(
  options: DefaultApiKeyPayloadOptions
): ApiKeyFormData {
  const values = getApiKeyFormDefaultValues(false)

  return transformFormDataToPayload(
    {
      ...values,
      name: options.name ?? 'default',
    },
    true
  )
}

export async function runInitialApiKeyCreate(
  deps: InitialApiKeyCreateDeps
): Promise<InitialApiKeyCreateResult> {
  const result = await deps.ensureInitialKey()
  if (!result.success || !result.data) {
    return {
      status: 'create-failed',
      consumeSearch: false,
      message: result.message,
    }
  }

  if (!result.data.created) {
    return { status: 'skipped-existing', consumeSearch: true }
  }

  if (!result.data.key) {
    return {
      status: 'create-failed',
      consumeSearch: false,
      message: result.message,
    }
  }

  return {
    status: 'created',
    consumeSearch: true,
    key: result.data.key,
  }
}

export async function ensureInitialApiKeyCreateOnce(
  deps: InitialApiKeyCreateDeps
): Promise<InitialApiKeyCreateResult> {
  if (initialApiKeyCreateScopeKey !== deps.scopeKey) {
    resetInitialApiKeyCreateOnce()
    initialApiKeyCreateScopeKey = deps.scopeKey
  }

  if (initialApiKeyCreateResult) return initialApiKeyCreateResult

  if (!initialApiKeyCreateInFlight) {
    const requestScopeKey = deps.scopeKey
    initialApiKeyCreateInFlight = runInitialApiKeyCreate(deps).then(
      (result) => {
        if (initialApiKeyCreateScopeKey !== requestScopeKey) return result
        if (
          result.status === 'created' ||
          result.status === 'skipped-existing'
        ) {
          initialApiKeyCreateResult = result
        }
        if (result.status !== 'skipped-existing') {
          initialApiKeyCreateInFlight = null
        }
        return result
      },
      (error: unknown) => {
        if (initialApiKeyCreateScopeKey === requestScopeKey) {
          initialApiKeyCreateInFlight = null
        }
        throw error
      }
    )
  }

  return initialApiKeyCreateInFlight
}

export function resetInitialApiKeyCreateOnce(): void {
  initialApiKeyCreateScopeKey = null
  initialApiKeyCreateInFlight = null
  initialApiKeyCreateResult = null
}
