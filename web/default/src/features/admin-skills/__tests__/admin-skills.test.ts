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

// Coverage: route guard, DR-45 API params, filter wiring, mobile read-only contract.

import fs from 'node:fs'
import path from 'node:path'
import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLE } from '@/lib/roles'
import { api } from '@/lib/api'
import { Route } from '@/routes/_authenticated/skills/admin'
import { getAdminSkills } from '../api'

const authState = vi.hoisted(() => ({
  user: null as { id: number; username: string; role: number } | null,
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({
      data: {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, has_next: false },
      },
    })),
  },
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      auth: {
        user: authState.user,
        setUser: (
          user: { id: number; username: string; role: number } | null
        ) => {
          authState.user = user
        },
        reset: () => {
          authState.user = null
        },
      },
    }),
  },
}))

function setUserRole(role: number | null) {
  authState.user =
    role == null
      ? null
      : {
          id: 1,
          username: 'reviewer',
          role,
        }
}

describe('DR-49 Admin Skills route guard', () => {
  beforeEach(() => {
    setUserRole(null)
  })

  it('allows Super Admin to enter /skills/admin', () => {
    setUserRole(ROLE.SUPER_ADMIN)

    expect(() => Route.options.beforeLoad?.({} as never)).not.toThrow()
  })

  it('redirects non-Super Admin users to /403', () => {
    setUserRole(ROLE.ADMIN)

    let caught: unknown
    try {
      Route.options.beforeLoad?.({} as never)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect((caught as { options: { to: string } }).options.to).toBe('/403')
  })
})

describe('DR-49 Admin Skills API/filter contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards status, required_plan, and kids_approval_status to DR-45', async () => {
    const params = {
      page: 2,
      limit: 50,
      status: 'published' as const,
      required_plan: 'pro' as const,
      kids_approval_status: 'approved' as const,
    }

    await getAdminSkills(params)

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/admin/skills',
      expect.objectContaining({
        params,
        skipErrorHandler: true,
      })
    )
  })

  it('wires the table filters to the DR-45 query parameter names', () => {
    const tableSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-table.tsx'
      ),
      'utf8'
    )

    expect(tableSource).toContain("searchKey: 'status'")
    expect(tableSource).toContain("searchKey: 'required_plan'")
    expect(tableSource).toContain("searchKey: 'kids_approval_status'")
    expect(tableSource).toContain('required_plan: requiredPlan')
    expect(tableSource).toContain(
      'kids_approval_status: kidsApprovalStatus'
    )
  })

  it('keeps mobile read-only: preview only, no edit or lifecycle actions', () => {
    const mobileSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-mobile-list.tsx'
      ),
      'utf8'
    )

    expect(mobileSource).toContain("t('Preview Skill')")
    expect(mobileSource).not.toContain("t('Edit Skill')")
    expect(mobileSource).not.toContain("t('Publish')")
    expect(mobileSource).not.toContain("t('Deprecate')")
    expect(mobileSource).not.toContain("t('Archive')")
    expect(mobileSource).not.toContain("t('Audit')")
  })
})
