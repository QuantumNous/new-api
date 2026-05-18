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

// Wizard step is encoded in the URL so browser back/forward and refresh
// land on the same step the user was on. Default = 'persona' (step 1).
const welcomeSearchSchema = z.object({
  step: z.enum(['persona', 'brand']).optional(),
})

export const Route = createFileRoute('/welcome')({
  component: RouteComponent,
  validateSearch: welcomeSearchSchema,
})

function RouteComponent() {
  const { step = 'persona' } = Route.useSearch()
  return <Welcome step={step} />
}
