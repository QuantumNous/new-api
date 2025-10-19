import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Users } from '@/features/users'

const usersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z
    .array(z.enum(['1', '2']))
    .optional()
    .catch([]),
  role: z
    .array(z.enum(['1', '10', '100']))
    .optional()
    .catch([]),
  group: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/users/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: usersSearchSchema,
  component: Users,
})
