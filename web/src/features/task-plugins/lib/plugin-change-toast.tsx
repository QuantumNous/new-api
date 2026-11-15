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
import { toast } from 'sonner'

import type { ModelPricingIssue } from '@/features/system-settings/models/pricing-issues'

import { PricingIssueList } from '../components/pricing-issue-list'

/**
 * Confirms a plugin change. When the serving plugin cannot charge some of its
 * models, the toast lists them instead of reporting plain success.
 */
export function toastPluginChange(
  title: string,
  issues: ModelPricingIssue[] | null | undefined
) {
  if (!issues?.length) {
    toast.success(title)
    return
  }
  toast.warning(title, { description: <PricingIssueList issues={issues} /> })
}
