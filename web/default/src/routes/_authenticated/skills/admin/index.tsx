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
import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { AdminSkills } from '@/features/admin-skills'

const adminSkillsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(20),
  status: z
    .array(z.enum(['draft', 'published', 'deprecated', 'archived']))
    .optional()
    .catch([]),
  required_plan: z
    .array(z.enum(['free', 'pro', 'enterprise']))
    .optional()
    .catch([]),
  kids_approval_status: z
    .array(
      z.enum([
        'not_required',
        'pending',
        'approved',
        'emergency_approved',
        'rejected',
        'revoked',
      ])
    )
    .optional()
    .catch([]),
})

export const Route = createFileRoute('/_authenticated/skills/admin/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.SUPER_ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: adminSkillsSearchSchema,
  component: AdminSkills,
})
