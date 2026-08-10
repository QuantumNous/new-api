import { ApiError } from './types'
import { publicHttpTransport } from './httpTransport'

export type SetupUsageMode = 'external' | 'self' | 'demo'

export interface SetupStatus {
  status: boolean
  root_init: boolean
  database_type: string
}

export interface SetupFormValues {
  username: string
  password: string
  confirmPassword: string
  usageMode: SetupUsageMode
}

export interface SetupPayload {
  SelfUseModeEnabled: boolean
  DemoSiteEnabled: boolean
  username?: string
  password?: string
  confirmPassword?: string
}

const SETUP_USERNAME_MAX_CHARACTERS = 12

export function setupCharacterLength(value: string): number {
  return Array.from(value).length
}

export function isSetupUsernameWithinLimit(username: string): boolean {
  return setupCharacterLength(username) <= SETUP_USERNAME_MAX_CHARACTERS
}

const DEFAULT_SETUP_ERROR = 'Invalid setup API response'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function invalidResponse(endpoint: string): never {
  throw new ApiError(`${DEFAULT_SETUP_ERROR}: ${endpoint}`, {
    status: 502,
    code: 'INVALID_RESPONSE',
  })
}

export function parseSetupStatus(value: unknown): SetupStatus {
  if (
    !isRecord(value) ||
    typeof value.status !== 'boolean' ||
    typeof value.root_init !== 'boolean' ||
    typeof value.database_type !== 'string'
  ) {
    invalidResponse('/api/setup')
  }
  return {
    status: value.status,
    root_init: value.root_init,
    database_type: value.database_type,
  }
}

export function parseSetupStatusEnvelope(value: unknown): SetupStatus {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !Object.hasOwn(value, 'data')
  ) {
    invalidResponse('/api/setup')
  }
  return parseSetupStatus(value.data)
}

export function parseSetupSubmitEnvelope(value: unknown): void {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    invalidResponse('/api/setup')
  }
  if (!value.success) {
    throw new ApiError(
      typeof value.message === 'string' && value.message
        ? value.message
        : 'Setup initialization failed',
      { status: 200, business: true }
    )
  }
}

export function buildSetupPayload(
  values: SetupFormValues,
  rootInitialized: boolean
): SetupPayload {
  const modeFlags = {
    SelfUseModeEnabled: values.usageMode === 'self',
    DemoSiteEnabled: values.usageMode === 'demo',
  }
  if (rootInitialized) return modeFlags
  return {
    ...modeFlags,
    username: values.username.trim(),
    password: values.password,
    confirmPassword: values.confirmPassword,
  }
}

export const setupApi = {
  async status(signal?: AbortSignal): Promise<SetupStatus> {
    const envelope = await publicHttpTransport.request<unknown>(
      'GET',
      '/api/setup',
      { signal, params: { t: Date.now() } }
    )
    return parseSetupStatusEnvelope(envelope)
  },

  async submit(payload: SetupPayload, signal?: AbortSignal): Promise<void> {
    const envelope = await publicHttpTransport.request<unknown>(
      'POST',
      '/api/setup',
      { signal, data: payload }
    )
    parseSetupSubmitEnvelope(envelope)
  },
}
