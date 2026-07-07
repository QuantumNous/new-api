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

    // Module policy first: a disabled or auth-gated rankings module must not
    // bounce visitors to the public website via old console URLs.
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

    // Hand over to the official website rankings page (single public
    // surface), keeping the locale prefix. English lives at the root path.
    if (OFFICIAL_WEBSITE_ORIGIN) {
      const locale = (args.params as { locale?: string }).locale
      const path =
        locale && locale !== 'en' ? `/${locale}/rankings` : '/rankings'
      window.location.replace(officialWebsiteUrl(path))
      await new Promise(() => {})
    }
  },
  component: Rankings,
})
