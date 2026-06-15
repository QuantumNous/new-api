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
import { useAuthStore } from '@/stores/auth-store'
import { AffiliateCdk } from '@/features/affiliate-cdk'
import { REDEMPTION_STATUS_VALUES } from '@/features/redemption-codes/constants'

const affiliateCdkSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z.array(z.enum(REDEMPTION_STATUS_VALUES)).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/affiliate-cdk/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user?.affiliate_cdk_enabled !== true) {
      throw redirect({ to: '/wallet' })
    }
  },
  validateSearch: affiliateCdkSearchSchema,
  component: AffiliateCdk,
})
