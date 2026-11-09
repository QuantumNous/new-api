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

import { ModelSettings } from '@/apps/admin/features/system-settings/models'
import {
  SETTINGS_MODELS_DEFAULT_SECTION,
  SETTINGS_MODELS_SECTION_IDS,
} from '@/apps/admin/routes/section-ids'

export const Route = createFileRoute(
  '/_admin/admin/system-settings/models/$section'
)({
  beforeLoad: ({ params }) => {
    if (params.section === 'channel-affinity') {
      throw redirect({
        to: '/admin/system-settings/request-policies/$section',
        params: { section: 'routing' },
        replace: true,
      })
    }
    if (params.section === 'routing-reliability') {
      throw redirect({
        to: '/admin/system-settings/request-policies/$section',
        params: { section: 'routing' },
        replace: true,
      })
    }
    const validSections = SETTINGS_MODELS_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/admin/system-settings/models/$section',
        params: { section: SETTINGS_MODELS_DEFAULT_SECTION },
      })
    }
  },
  component: ModelSettings,
})
