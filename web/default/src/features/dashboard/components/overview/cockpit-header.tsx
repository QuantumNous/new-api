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

export function CockpitHeader() {
  const { t } = useTranslation()

  return (
    <section className='relative overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-900/70 p-5 shadow-lg shadow-indigo-950/30 backdrop-blur-md sm:p-6'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-80'
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 10% 0%, oklch(0.45 0.18 265 / 40%) 0%, transparent 65%)',
            'radial-gradient(ellipse 55% 50% at 90% 20%, oklch(0.42 0.16 290 / 35%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <div className='relative flex flex-col gap-2'>
        <p className='text-xs font-medium tracking-widest text-violet-300/90 uppercase'>
          {t('Dashboard platform overview title')}
        </p>
        <h2 className='text-xl font-bold tracking-tight text-slate-50 sm:text-2xl'>
          <span className='bg-gradient-to-r from-blue-300 via-violet-300 to-purple-400 bg-clip-text text-transparent'>
            {DEFAULT_SYSTEM_NAME}
          </span>
          <span className='mt-1 block text-lg font-semibold text-slate-200 sm:inline sm:mt-0 sm:ml-2'>
            · {t('Dashboard Operations Cockpit')}
          </span>
        </h2>
        <p className='max-w-3xl text-sm leading-relaxed text-slate-400'>
          {t('Dashboard Operations Cockpit description')}
        </p>
      </div>
    </section>
  )
}
