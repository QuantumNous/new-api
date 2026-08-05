import type {
  AuthBundle,
  AuthTokenRotation,
  LoginSession,
  TwoFactorChallenge,
  UserInfo,
} from '@/types/auth'
import { ApiError } from '@/api/types'

let activeBundle: AuthBundle | null = null
let revision = 0
let generation = 0

export interface AuthSessionSnapshot {
  bundle: AuthBundle | null
  revision: number
  generation: number
}

export class AuthSessionInvalidatedError extends ApiError {
  constructor(cause?: unknown) {
    super('Authentication session is no longer valid', {
      status: 401,
      code: 'AUTH_SESSION_INVALIDATED',
      cause,
    })
    this.name = 'AuthSessionInvalidatedError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isUserInfo(value: unknown): value is UserInfo {
  if (!isRecord(value)) return false
  return (
    Number.isInteger(value.id) &&
    Number(value.id) > 0 &&
    typeof value.username === 'string' &&
    typeof value.display_name === 'string' &&
    typeof value.email === 'string' &&
    isFiniteNumber(value.role) &&
    isFiniteNumber(value.quota) &&
    isFiniteNumber(value.used_quota)
  )
}

function isLoginSession(value: unknown): value is LoginSession {
  if (!isRecord(value)) return false
  return (
    typeof value.sid === 'string' &&
    value.sid.length > 0 &&
    typeof value.current === 'boolean' &&
    typeof value.login_method === 'string' &&
    typeof value.ip === 'string' &&
    typeof value.user_agent === 'string' &&
    isFiniteNumber(value.created_at) &&
    isFiniteNumber(value.last_active_at) &&
    isFiniteNumber(value.expires_at)
  )
}

function hasTokenFields(
  value: Record<string, unknown>
): value is Record<string, unknown> & AuthTokenRotation {
  return (
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    value.token_type === 'Bearer' &&
    isFiniteNumber(value.access_expires_at) &&
    value.access_expires_at > 0 &&
    isLoginSession(value.session) &&
    value.session.current
  )
}

export function parseAuthBundle(value: unknown): AuthBundle | null {
  if (!isRecord(value) || !hasTokenFields(value) || !isUserInfo(value.user)) {
    return null
  }
  return value as unknown as AuthBundle
}

export function parseAuthRotation(value: unknown): AuthTokenRotation | null {
  if (!isRecord(value) || !hasTokenFields(value)) return null
  return value as unknown as AuthTokenRotation
}

export function parseTwoFactorChallenge(
  value: unknown
): TwoFactorChallenge | null {
  if (!isRecord(value)) return null
  if (
    value.require_2fa !== true ||
    typeof value.flow_token !== 'string' ||
    value.flow_token.length === 0 ||
    !isFiniteNumber(value.expires_at) ||
    value.expires_at <= 0
  ) {
    return null
  }
  return value as unknown as TwoFactorChallenge
}

export function setAuthBundle(bundle: AuthBundle): void {
  activeBundle = bundle
  revision++
  generation++
}

export function applyAuthRotation(rotation: AuthTokenRotation): void {
  if (!activeBundle || activeBundle.session.sid !== rotation.session.sid) {
    throw new Error('Authentication rotation session mismatch')
  }
  activeBundle = { ...rotation, user: activeBundle.user }
  revision++
}

export function getAuthBundle(): AuthBundle | null {
  return activeBundle
}

export function getAuthSessionSnapshot(): AuthSessionSnapshot {
  return { bundle: activeBundle, revision, generation }
}

export function getAuthSessionGeneration(): number {
  return generation
}

export function isAuthSessionCurrent(snapshot: AuthSessionSnapshot): boolean {
  return (
    revision === snapshot.revision &&
    activeBundle?.session.sid === snapshot.bundle?.session.sid
  )
}

export function isAuthSessionIdentityCurrent(
  snapshot: AuthSessionSnapshot
): boolean {
  return generation === snapshot.generation
}

export function setAuthBundleIfCurrent(
  snapshot: AuthSessionSnapshot,
  bundle: AuthBundle
): boolean {
  if (
    !isAuthSessionCurrent(snapshot) ||
    (snapshot.bundle && bundle.session.sid !== snapshot.bundle.session.sid)
  ) {
    return false
  }
  return replaceAuthBundleIfCurrent(snapshot, bundle)
}

export function replaceAuthBundleIfCurrent(
  snapshot: AuthSessionSnapshot,
  bundle: AuthBundle
): boolean {
  if (!isAuthSessionCurrent(snapshot)) return false
  const identityChanged = activeBundle?.user.id !== bundle.user.id
  activeBundle = bundle
  revision++
  if (identityChanged) generation++
  return true
}

export function clearAuthBundleIfCurrent(
  snapshot: AuthSessionSnapshot
): boolean {
  if (!isAuthSessionCurrent(snapshot)) return false
  activeBundle = null
  revision++
  generation++
  return true
}

export function clearAuthBundle(): void {
  activeBundle = null
  revision++
  generation++
}
