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

import type { PricingVendor } from '@/features/pricing/types'
import { getLobeIcon } from '@/lib/lobe-icon'

import { fillProviderMarquee } from '../../lib/catalog'

type ProviderMarqueeItem = {
  key: string
  vendor: PricingVendor
}

const PROVIDERS: PricingVendor[] = [
  { id: 1, name: 'Claude', icon: 'Claude' },
  { id: 2, name: 'Gemini', icon: 'Gemini' },
  { id: 3, name: 'Grok', icon: 'Grok' },
  { id: 4, name: 'ChatGPT', icon: 'OpenAI' },
]

const PROVIDER_MARQUEE_ITEMS = fillProviderMarquee(PROVIDERS).map(
  (vendor, position) => ({
    key: `${vendor.id}-${position + 1}`,
    vendor,
  })
)

function ProviderGroup(props: {
  items: ProviderMarqueeItem[]
  hidden?: boolean
}) {
  return (
    <div
      className='flex shrink-0 items-center gap-8 pe-8'
      aria-hidden={props.hidden || undefined}
    >
      {props.items.map((item) => (
        <div
          key={item.key}
          className='text-foreground flex shrink-0 items-center gap-2.5 text-sm font-medium'
        >
          <span className='bg-muted flex size-8 items-center justify-center rounded-lg'>
            {getLobeIcon(item.vendor.icon || item.vendor.name, 20)}
          </span>
          <span className='max-w-40 truncate'>{item.vendor.name}</span>
        </div>
      ))}
    </div>
  )
}

export function ProviderMarquee() {
  const { t } = useTranslation()

  return (
    <div className='border-border/70 w-full border-t'>
      <div className='mx-auto w-full max-w-6xl px-4 pt-5 pb-7 sm:px-6'>
        <div className='text-muted-foreground mb-4 flex items-center justify-between gap-4 text-xs'>
          <span>
            {t('Connect to the model providers configured on this site')}
          </span>
          <span className='shrink-0 tabular-nums'>
            {t('Provider')} · {PROVIDERS.length}
          </span>
        </div>

        <div
          className='home-provider-marquee no-scrollbar overflow-hidden'
          aria-label={t('Providers available on this site')}
        >
          <div className='home-provider-marquee-track flex w-max'>
            <ProviderGroup items={PROVIDER_MARQUEE_ITEMS} />
            <ProviderGroup items={PROVIDER_MARQUEE_ITEMS} hidden />
          </div>
        </div>
      </div>
    </div>
  )
}
