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
import { getFreshModuleAccess } from '@/lib/nav-modules'
import { OFFICIAL_WEBSITE_ORIGIN, officialWebsiteUrl } from '@/lib/origins'
import { beforeLoadPublicLocaleRoute } from '@/lib/public-locale-route'
import { Rankings } from '@/features/rankings'

const rankingsSearchSchema = z.object({
  period: z
    .enum(['today', 'week', 'month', 'year', 'all'])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/$locale/rankings/')({
  validateSearch: rankingsSearchSchema,
  beforeLoad: async (args) => {
    beforeLoadPublicLocaleRoute(args)

    // With an official website configured, its /rankings is the single public
    // surface — hand over unconditionally (keeping the locale prefix) so old
    // links keep working for anonymous visitors. The console module policy
    // below only governs the local fallback page (self-host, no origin).
    if (OFFICIAL_WEBSITE_ORIGIN) {
      const locale = (args.params as { locale?: string }).locale
      const path =
        locale && locale !== 'en' ? `/${locale}/rankings` : '/rankings'
      window.location.replace(officialWebsiteUrl(path))
      await new Promise(() => {})
    }

    const access = await getFreshModuleAccess('rankings')
    if (!access.enabled) {
      throw redirect({ to: '/' })
    }
    if (access.requireAuth) {
      const { auth } = useAuthStore.getState()
      if (!auth.user) {
        throw redirect({
          to: '/sign-in',
          search: { redirect: args.location.href },
        })
      }
    }
  },
  component: Rankings,
})
