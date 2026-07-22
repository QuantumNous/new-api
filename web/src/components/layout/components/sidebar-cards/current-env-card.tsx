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
import { Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Sidebar card showing the user's current group (i.e. "environment").
 * Hidden when the sidebar is collapsed to icon mode.
 */
export function CurrentEnvCard() {
  const { t } = useTranslation()
  const group = useAuthStore((s) => s.auth.user?.group)

  const groupLabel = group && group.length > 0 ? group : t('default')

  return (
    <div className='card-glass group-data-[collapsible=icon]:hidden flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sidebar-foreground'>
      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--accent-blue)_15%,transparent)] text-[var(--accent-blue)]'>
        <Server className='size-4' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-[10px] tracking-wide text-muted-foreground uppercase'>
          {t('Current Environment')}
        </div>
        <div className='truncate text-sm font-medium capitalize'>
          {groupLabel}
        </div>
      </div>
      <span className='size-2 shrink-0 rounded-full bg-success shadow-[0_0_8px_var(--success)]' />
    </div>
  )
}
