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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getFreshModuleAccess } from '@/lib/nav-modules'
import { OFFICIAL_WEBSITE_ORIGIN, officialWebsiteUrl } from '@/lib/origins'
import { localizePublicPath } from '@/lib/public-locale'
import { beforeLoadPublicLocaleRoute } from '@/lib/public-locale-route'
import { ModelDetails } from '@/features/pricing/components/model-details'
import { publicPricingSearchSchema } from '@/features/pricing/lib/public-search'

export const Route = createFileRoute('/$locale/pricing/$modelId/')({
  validateSearch: publicPricingSearchSchema,
  beforeLoad: async (args) => {
    beforeLoadPublicLocaleRoute(args)

    // With an official website configured, /models/<model> there is the single
    // public model surface (Rule 9) — hand over unconditionally so old links
    // keep working for anonymous visitors. The console module policy below
    // only governs the local fallback page (self-host, no origin configured).
    if (OFFICIAL_WEBSITE_ORIGIN) {
      const locale = args.params.locale
      const modelPath = `/models/${encodeURIComponent(args.params.modelId)}`
      const path =
        locale && locale !== 'en' ? `/${locale}${modelPath}` : modelPath
      window.location.replace(officialWebsiteUrl(path))
      await new Promise(() => {})
    }

    const access = await getFreshModuleAccess('pricing')
    if (!access.enabled) {
      throw redirect({ to: localizePublicPath('/', args.params.locale) })
    }
    if (access.requireAuth) {
      const { auth } = useAuthStore.getState()
      if (!auth.user) {
        throw redirect({
          to: localizePublicPath('/sign-in', args.params.locale),
          search: { redirect: args.location.href },
        })
      }
    }
  },
  component: ModelDetails,
})
