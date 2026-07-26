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
  { id: 1, name: 'Grok', icon: "Grok.Avatar.shape={'square'}" },
  {
    id: 2,
    name: 'ChatGPT',
    icon: "OpenAI.Avatar.type={'platform'}.shape={'square'}",
  },
  { id: 3, name: 'Claude', icon: 'Claude.Color' },
  { id: 4, name: 'Gemini', icon: 'Gemini.Color' },
]

const PROVIDER_MARQUEE_ITEMS = fillProviderMarquee(PROVIDERS).map(
  (vendor, position) => ({
    key: `${vendor.id}-${position + 1}`,
    vendor,
  })
)

function ProviderGroup(props: { items: ProviderMarqueeItem[] }) {
  return (
    <div className='flex shrink-0 items-center gap-8 pe-8'>
      {props.items.map((item) => (
        <div
          key={item.key}
          className='text-foreground flex shrink-0 items-center gap-2.5 text-sm font-medium'
        >
          <span className='border-border/70 bg-card flex size-9 items-center justify-center overflow-hidden rounded-lg border shadow-xs'>
            {getLobeIcon(item.vendor.icon || item.vendor.name, 25)}
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
    <div className='border-border/70 w-full min-w-0 border-t'>
      <div className='mx-auto w-full max-w-6xl min-w-0 px-4 pt-6 pb-8 sm:px-6 sm:pb-10'>
        <div className='home-provider-marquee no-scrollbar overflow-hidden'>
          <span className='sr-only'>
            {t('Providers available on this site')}:{' '}
            {PROVIDERS.map((provider) => provider.name).join(', ')}
          </span>
          <div
            className='home-provider-marquee-track flex w-max'
            aria-hidden='true'
          >
            <ProviderGroup items={PROVIDER_MARQUEE_ITEMS} />
            <ProviderGroup items={PROVIDER_MARQUEE_ITEMS} />
          </div>
        </div>
      </div>
    </div>
  )
}
