import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Models } from '@/features/models'
import {
  MODELS_SECTION_IDS,
  MODELS_DEFAULT_SECTION,
} from '@/features/models/section-registry'

const modelsSearchSchema = z.object({
  section: z
    .enum(MODELS_SECTION_IDS as unknown as [string, ...string[]])
    .optional()
    .catch(MODELS_DEFAULT_SECTION),
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  vendor: z.array(z.string()).optional().catch([]),
  status: z.array(z.string()).optional().catch([]),
  sync: z.array(z.string()).optional().catch([]),
  // Deployments section (use dedicated keys to avoid clashing with metadata table)
  dPage: z.number().optional().catch(1),
  dPageSize: z.number().optional().catch(10),
  dFilter: z.string().optional().catch(''),
  dStatus: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/models/')({
  beforeLoad: ({ search }) => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }

    // Redirect to default section if no section is provided
    if (!search?.section) {
      throw redirect({
        to: '/models',
        search: { section: MODELS_DEFAULT_SECTION },
      })
    }
  },
  validateSearch: modelsSearchSchema,
  component: Models,
})
