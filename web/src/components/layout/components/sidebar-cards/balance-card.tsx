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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'

/**
 * Sidebar balance card — shows available quota with a quick "Top Up" CTA.
 * Hidden when the sidebar collapses to icon-only mode.
 */
export function BalanceCard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)

  const quota = user?.quota ?? 0
  const display = formatQuota(quota)

  return (
    <div className='card-glass group-data-[collapsible=icon]:hidden flex flex-col gap-2 rounded-xl px-3 py-3'>
      <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
        {t('Available Balance')}
      </div>
      <div className='font-semibold tabular-nums text-foreground text-lg'>
        {display}
      </div>
      <Button size='sm' className='h-8 w-full' render={<Link to='/wallet' />}>
        {t('Top Up')}
      </Button>
    </div>
  )
}
