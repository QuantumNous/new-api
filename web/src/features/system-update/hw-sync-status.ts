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
import { z } from 'zod'

import type { SystemRelease } from './releases'

// Our fork follows one upstream tag at a time, so the server answers with a
// single record instead of a release list: the highest published upstream tag,
// the tag our main already merged, and the open sync pull request if there is
// one. The dialog keeps consuming a release, so the record is mapped onto it.
const syncStatusSchema = z.object({
  success: z.boolean(),
  data: z.object({
    upstreamTag: z.string().trim().min(1),
    mergedTag: z.string().nullable(),
    prNumber: z.number().int().positive().nullable(),
    checkedAt: z.iso.datetime(),
  }),
})

export function syncStatusToRelease(payload: unknown): SystemRelease {
  const status = syncStatusSchema.parse(payload)
  if (!status.success) throw new Error('Unexpected sync status payload')
  const { upstreamTag, mergedTag, prNumber, checkedAt } = status.data
  return {
    tag_name: upstreamTag,
    published_at: checkedAt,
    prerelease: false,
    merged: mergedTag,
    prNumber,
  }
}
