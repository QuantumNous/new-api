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
import { ArrowRight, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { COCKPIT_CARD_CLASS } from './cockpit-display'

export function CockpitTenantRanking() {
  const { t } = useTranslation()

  return (
    <div
      className={`flex h-full min-h-[18rem] flex-col justify-between gap-4 p-5 ${COCKPIT_CARD_CLASS}`}
    >
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Users className='size-4 text-blue-600' aria-hidden='true' />
          <h3 className='text-sm font-semibold text-slate-900'>
            {t('Dashboard chart tenant ranking')}
          </h3>
        </div>
        <p className='text-xs leading-relaxed text-slate-600'>
          {t('Dashboard chart tenant ranking description')}
        </p>
      </div>
      <Button
        className='w-full justify-between border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
        variant='outline'
        render={<Link to='/dashboard/users' />}
      >
        {t('Dashboard view user analytics')}
        <ArrowRight data-icon='inline-end' />
      </Button>
    </div>
  )
}
