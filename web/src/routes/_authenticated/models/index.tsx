import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Models } from '@/features/models'

const modelsSearchSchema = z.object({
  tab: z.enum(['metadata', 'deployments']).optional(),
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  vendor: z.array(z.string()).optional().catch([]),
  status: z.array(z.string()).optional().catch([]),
  sync: z.array(z.string()).optional().catch([]),
  // Deployments tab (use dedicated keys to avoid clashing with metadata table)
  dPage: z.number().optional().catch(1),
  dPageSize: z.number().optional().catch(10),
  dFilter: z.string().optional().catch(''),
  dStatus: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/models/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: modelsSearchSchema,
  component: Models,
})
