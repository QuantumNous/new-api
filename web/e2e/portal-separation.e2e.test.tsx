import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

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
import { AxiosError, type AxiosAdapter } from 'axios'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminAccess } from '@/apps/admin/routes/guards'
import { requireClientAccess } from '@/apps/client/routes/guards'
import { api } from '@/shared/lib/http-client'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import {
  captureRedirect,
  collectSourceFiles,
  readSource,
  resetAuth,
  seedAnonymous,
  seedAuthenticated,
} from './harness'

// Vitest is always invoked from the `web/` package root.
const WEB_ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Phase 1: architectural separation (static, shipped-code analysis)
// ---------------------------------------------------------------------------

describe('phase 1 - portal separation (static analysis)', () => {
  it('no shared or client module imports admin application code', () => {
    const files = [
      ...collectSourceFiles(resolve(WEB_ROOT, 'src/shared')),
      ...collectSourceFiles(resolve(WEB_ROOT, 'src/apps/client')),
    ]
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.filter((file) =>
      /@\/apps\/admin/.test(readSource(file))
    )
    expect(offenders).toEqual([])
  })

  it('the client portal ships no admin-only API endpoint', () => {
    const forbidden = [
      '/api/channel',
      '/api/user/manage',
      '/api/option/',
      '/api/subscription/admin',
      '/api/audit',
    ]
    const files = collectSourceFiles(resolve(WEB_ROOT, 'src/apps/client'))

    const offenders: string[] = []
    for (const file of files) {
      const source = readSource(file)
      for (const endpoint of forbidden) {
        if (source.includes(endpoint)) offenders.push(`${file}: ${endpoint}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('admin-only pages are namespaced under the _admin branch', () => {
    // The only admin route allowed outside the guarded `_admin` layout is the
    // anonymous admin login.
    expect(existsSync(resolve(WEB_ROOT, 'src/routes/admin/login.tsx'))).toBe(
      true
    )
    for (const file of collectSourceFiles(
      resolve(WEB_ROOT, 'src/routes/admin')
    )) {
      expect(file.endsWith('login.tsx')).toBe(true)
    }

    // Each portal layout references only its own portal's navigation.
    const adminLayout = readSource(
      resolve(WEB_ROOT, 'src/apps/admin/layout/admin-layout.tsx')
    )
    const clientLayout = readSource(
      resolve(WEB_ROOT, 'src/apps/client/layout/client-layout.tsx')
    )
    expect(adminLayout).not.toMatch(/apps\/client\/layout/)
    expect(clientLayout).not.toMatch(/apps\/admin\/layout/)
  })
})

describe('phase 1 - entry chunk hygiene', () => {
  it('admin route configs never import a section registry', () => {
    const files = collectSourceFiles(resolve(WEB_ROOT, 'src/routes/_admin'))
    expect(files.length).toBeGreaterThan(0)

    // `beforeLoad`/`validateSearch` code is bundled into the initial chunk, so
    // importing a section registry there pulls the whole admin settings graph
    // (components and admin-only API modules) into every visitor's download,
    // including the client portal. Section ids come from the plain module
    // `@/apps/admin/routes/section-ids` instead.
    const offenders = files.filter((file) =>
      /from ['"]@\/apps\/admin\/features\/.+\/section-registry(\.tsx?)?['"]/.test(
        readSource(file)
      )
    )
    expect(offenders).toEqual([])
  })

  it('the shared section-id module stays dependency-free', () => {
    const source = readSource(
      resolve(WEB_ROOT, 'src/apps/admin/routes/section-ids.ts')
    )
    expect(source).not.toMatch(/^import /m)
  })
})

// ---------------------------------------------------------------------------
// Phase 2: simulated penetration tests
// ---------------------------------------------------------------------------

describe('phase 2 - direct admin route access (URL tampering)', () => {
  afterEach(() => {
    resetAuth()
    vi.restoreAllMocks()
  })

  it('denies a regular user and redirects them to the client portal', async () => {
    seedAuthenticated(ROLE.USER)
    const error = vi.spyOn(toast, 'error')

    const redirect = await captureRedirect(() =>
      requireAdminAccess('http://localhost/admin/overview')
    )

    expect(redirect).not.toBeNull()
    expect(redirect?.options.to).toBe('/app/workspace/$section')
    expect(redirect?.options.params).toEqual({ section: 'overview' })
    expect(error).toHaveBeenCalledWith(
      'Access Denied',
      expect.objectContaining({
        description: 'You do not have permission to access the admin portal.',
      })
    )
  })

  it('admits an administrator', async () => {
    seedAuthenticated(ROLE.ADMIN)
    expect(
      await captureRedirect(() => requireAdminAccess('/admin/overview'))
    ).toBeNull()
  })

  it('sends an anonymous visitor to the admin login with the return path', async () => {
    seedAnonymous()
    const redirect = await captureRedirect(() =>
      requireAdminAccess('/admin/overview')
    )
    expect(redirect?.options.to).toBe('/admin/login')
    expect(redirect?.options.search).toEqual({ redirect: '/admin/overview' })
  })
})

describe('phase 2 - role privilege escalation is decided server-side', () => {
  const originalAdapter = api.defaults.adapter

  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
    resetAuth()
    vi.restoreAllMocks()
  })

  function forbiddenAdapter(): AxiosAdapter {
    return async (config) => {
      throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, {
        data: { success: false, message: 'forbidden' },
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config,
      })
    }
  }

  it('a tampered Root role still receives 403 from the server for admin APIs', async () => {
    // The store lives only in memory and is never an authorization authority:
    // a forged role still gets 403 from the backend, and the interceptor
    // surfaces it exactly once without ever retrying with more privilege.
    seedAuthenticated(ROLE.SUPER_ADMIN)
    api.defaults.adapter = forbiddenAdapter()
    const error = vi.spyOn(toast, 'error')

    await expect(api.get('/api/channel/')).rejects.toMatchObject({
      response: { status: 403 },
    })

    expect(error).toHaveBeenCalledWith('Access Denied', {
      id: 'access-denied',
    })
  })

  it('the auth store never persists role data to localStorage', () => {
    seedAuthenticated(ROLE.SUPER_ADMIN)
    expect(localStorage.getItem('auth')).toBeNull()
    expect(localStorage.getItem('new-api-auth')).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})

describe('phase 2 - authentication bypass attempts', () => {
  afterEach(() => {
    resetAuth()
    vi.restoreAllMocks()
  })

  it('a request without a session is redirected to /login', async () => {
    seedAnonymous()
    const redirect = await captureRedirect(() =>
      requireClientAccess('http://localhost/app/workspace/overview')
    )
    expect(redirect?.options.to).toBe('/login')
    expect(redirect?.options.search).toEqual({
      redirect: 'http://localhost/app/workspace/overview',
    })
  })

  it('an expired in-memory token is not treated as a live client session', async () => {
    seedAuthenticated(ROLE.USER, { expired: true })
    // resolveAuthentication must not accept an expired token; with no reachable
    // refresh endpoint the guard falls back to login rather than rendering
    // protected UI.
    const redirect = await captureRedirect(() =>
      requireClientAccess('/app/workspace/overview')
    )
    expect(redirect?.options.to).toBe('/login')
  })

  it('a token injected without an attached user is rejected', async () => {
    useAuthStore.getState().auth.setBundle({
      access_token: 'malformed-token',
      token_type: 'Bearer',
      access_expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: null,
      session: null,
    } as unknown as AuthBundle)

    const redirect = await captureRedirect(() =>
      requireClientAccess('/app/workspace/overview')
    )
    expect(redirect?.options.to).toBe('/login')
  })
})
