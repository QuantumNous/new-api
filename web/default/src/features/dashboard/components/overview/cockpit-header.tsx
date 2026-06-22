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
import { useTranslation } from 'react-i18next'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'
import { COCKPIT_HEADER_CLASS } from './cockpit-display'

export function CockpitHeader() {
  const { t } = useTranslation()

  return (
    <section className={COCKPIT_HEADER_CLASS}>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-70'
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 10% 0%, oklch(0.88 0.06 250 / 55%) 0%, transparent 65%)',
            'radial-gradient(ellipse 55% 50% at 90% 20%, oklch(0.9 0.04 220 / 45%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <div className='relative flex flex-col gap-2'>
        <p className='text-xs font-medium tracking-widest text-blue-600/90 uppercase'>
          {t('Dashboard platform overview title')}
        </p>
        <h2 className='text-xl font-bold tracking-tight text-slate-900 sm:text-2xl'>
          <span className='bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent'>
            {DEFAULT_SYSTEM_NAME}
          </span>
          <span className='mt-1 block text-lg font-semibold text-slate-700 sm:inline sm:mt-0 sm:ml-2'>
            · {t('Dashboard Operations Cockpit')}
          </span>
        </h2>
        <p className='max-w-3xl text-sm leading-relaxed text-slate-600'>
          {t('Dashboard Operations Cockpit description')}
        </p>
      </div>
    </section>
  )
}
