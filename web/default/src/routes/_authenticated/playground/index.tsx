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
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { Main } from '@/components/layout'
import { Playground } from '@/features/playground'

export function validatePlaygroundSearch(
  search: Record<string, unknown>
): { first?: 1 } {
  // `?first=1` marks the post-registration first-run onboarding experience.
  // Keep the serialized URL stable as `first=1`; boolean values serialize as
  // `first=true`, while string values serialize with quotes.
  const first = search.first
  const isFirstRun =
    first === '1' || first === 1 || first === true || first === 'true'
  return isFirstRun ? { first: 1 } : {}
}

export const Route = createFileRoute('/_authenticated/playground/')({
  validateSearch: validatePlaygroundSearch,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PlaygroundPage,
})

function PlaygroundPage() {
  const { first } = Route.useSearch()
  return (
    <Main className='p-0'>
      <Playground firstRun={first === 1} />
    </Main>
  )
}
