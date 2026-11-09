import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
import { isRedirect, type AnyRedirect } from '@tanstack/react-router'
import { vi } from 'vitest'

import {
  useAuthStore,
  type AuthBundle,
  type AuthUser,
} from '@/shared/stores/auth-store'

export const SESSION_SID = 'session-under-test'

export function makeUser(
  role: number,
  overrides: Partial<AuthUser> = {}
): AuthUser {
  return {
    id: 42,
    username: 'audit-user',
    role,
    ...overrides,
  }
}

/**
 * Build an in-memory authentication bundle. `expired` produces a bundle whose
 * access token is already past `access_expires_at`, modelling a token that the
 * store still holds but that the server would reject.
 */
export function makeBundle(
  role: number,
  options: { expired?: boolean; user?: Partial<AuthUser>; sid?: string } = {}
): AuthBundle {
  const now = Math.floor(Date.now() / 1000)
  const sid = options.sid ?? SESSION_SID
  return {
    access_token: 'access-token-under-test',
    token_type: 'Bearer',
    access_expires_at: options.expired ? now - 1 : now + 3600,
    user: makeUser(role, options.user),
    session: {
      sid,
      current: true,
      login_method: 'password',
      ip: '127.0.0.1',
      user_agent: 'vitest',
      created_at: now - 10,
      last_active_at: now,
      expires_at: now + 3600,
    },
  }
}

/** Install a bundle directly, mirroring a completed sign-in. */
export function seedAuthenticated(
  role: number,
  options: { expired?: boolean } = {}
): AuthBundle {
  const bundle = makeBundle(role, options)
  useAuthStore.getState().auth.setBundle(bundle)
  return bundle
}

/**
 * Install an empty, already-resolved store state. `resolveAuthentication`
 * returns `anonymous` immediately in this state without touching the network.
 */
export function seedAnonymous(): void {
  useAuthStore.getState().auth.reset('complete')
}

export function resetAuth(): void {
  useAuthStore.getState().auth.reset('idle')
}

/** Run a guard and return the redirect it threw, or `null` when it let through. */
export async function captureRedirect(
  guard: () => Promise<void>
): Promise<AnyRedirect | null> {
  try {
    await guard()
    return null
  } catch (error) {
    if (isRedirect(error)) return error
    throw error
  }
}

export type LocationStub = {
  pathname: string
  href: string
  origin: string
  search: string
  replace: ReturnType<typeof vi.fn>
  assign: ReturnType<typeof vi.fn>
}

/** Replace `window.location` with a writable stub and return it. */
export function stubLocation(pathname: string): LocationStub {
  const stub: LocationStub = {
    pathname,
    href: `${'http://localhost'}${pathname}`,
    origin: 'http://localhost',
    search: '',
    replace: vi.fn(),
    assign: vi.fn(),
  }
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: stub,
  })
  return stub
}

export function restoreLocation(original: Location): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: original,
  })
}

/**
 * Recursively collect source files under a directory, excluding test files so
 * the static separation checks describe shipped code, not fixtures.
 */
export function collectSourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      found.push(...collectSourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue
    found.push(full)
  }
  return found
}

export function readSource(file: string): string {
  return readFileSync(file, 'utf8')
}
