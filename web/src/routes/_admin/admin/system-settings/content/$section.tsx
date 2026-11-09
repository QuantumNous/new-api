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

import { ContentSettings } from '@/apps/admin/features/system-settings/content'
import {
  SETTINGS_CONTENT_DEFAULT_SECTION,
  SETTINGS_CONTENT_SECTION_IDS,
} from '@/apps/admin/routes/section-ids'

export const Route = createFileRoute(
  '/_admin/admin/system-settings/content/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = SETTINGS_CONTENT_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/admin/system-settings/content/$section',
        params: { section: SETTINGS_CONTENT_DEFAULT_SECTION },
      })
    }
  },
  component: ContentSettings,
})
