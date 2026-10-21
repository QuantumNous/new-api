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

export interface PricingHeroProps {
  modelCount: number
  vendorCount: number
}

export function PricingHero(props: PricingHeroProps) {
  const { t } = useTranslation()
  const stats = [
    { value: `${props.modelCount}`, label: t('Models') },
    { value: `${props.vendorCount}`, label: t('Vendors') },
    { value: '99%', label: t('Service availability') },
  ]
  return (
    <header className='mx-auto mb-8 max-w-3xl pt-6 text-center sm:pt-10'>
      <p className='text-muted-foreground mb-3 text-xs font-medium tracking-[0.3em] uppercase'>
        MODEL PLAZA
      </p>
      <h1 className='text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.15] font-bold tracking-tight'>
        {t('Model Square')}
      </h1>
      <p className='text-muted-foreground/80 mt-3 text-sm sm:text-base'>
        {t('One gateway to access global AI models.')}
      </p>
      <div className='mt-6 flex items-center justify-center gap-8'>
        {stats.map((s) => (
          <div key={s.label} className='flex flex-col'>
            <span className='text-foreground text-2xl font-bold sm:text-3xl'>
              {s.value}
            </span>
            <span className='text-muted-foreground text-xs'>{s.label}</span>
          </div>
        ))}
      </div>
    </header>
  )
}
