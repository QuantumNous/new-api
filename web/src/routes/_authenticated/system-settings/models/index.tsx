import { createFileRoute, redirect } from '@tanstack/react-router'
import { MODELS_DEFAULT_SECTION } from '@/features/system-settings/models/section-registry.tsx'

export const Route = createFileRoute('/_authenticated/system-settings/models/')(
  {
    beforeLoad: () => {
      throw redirect({
        to: '/system-settings/models/$section',
        params: { section: MODELS_DEFAULT_SECTION },
      })
    },
  }
)
