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
import { createFileRoute } from '@tanstack/react-router'
import { Welcome } from '@/features/welcome'

// The welcome screen is now single-page (result + 3 steps + optional
// persona). The `step` search param is kept for backward-compatible deep
// links / bookmarks (?step=...) but is no longer used to drive the UI.
const welcomeSearchSchema = z.object({
  step: z.enum(['persona', 'brand']).optional(),
})

export const Route = createFileRoute('/welcome')({
  component: Welcome,
  validateSearch: welcomeSearchSchema,
})
