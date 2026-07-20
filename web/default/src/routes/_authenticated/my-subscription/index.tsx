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
import { createFileRoute } from '@tanstack/react-router'
import { TrialSubscriptionSection } from '@/features/wallet/components/trial-subscription-section'

export const Route = createFileRoute('/_authenticated/my-subscription/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='w-full min-w-0 bg-gradient-to-br from-violet-50 via-rose-50 to-sky-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900'>
      <div className='p-6'>
        <TrialSubscriptionSection />
      </div>
    </div>
  )
}
