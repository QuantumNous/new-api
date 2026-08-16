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
import type { ChannelFormValues } from './channel-form'

const contributionChannelEditableFields = new Set<keyof ChannelFormValues>([
  'tag',
  'priority',
  'weight',
])

export function hasDisallowedContributionChannelChanges(
  dirtyFields: Partial<Record<keyof ChannelFormValues, unknown>>
): boolean {
  return Object.entries(dirtyFields).some(
    ([field, dirty]) =>
      Boolean(dirty) &&
      !contributionChannelEditableFields.has(field as keyof ChannelFormValues)
  )
}
