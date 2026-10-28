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

import { getChannelTypeLabel } from '@/features/channels/lib'

import type { MarketplaceIndexVersion, MarketplacePlugin } from '../types'

type MarketplaceCapabilitiesProps = {
  plugin: MarketplacePlugin
  version?: MarketplaceIndexVersion
}

/**
 * The sensitive declarations an administrator needs before installing: where the
 * plugin may send requests, which channel types it can bind, how it
 * authenticates, and whether the source pins an integrity hash. Reading these is
 * far more effective than expecting a full source review, so they are surfaced
 * above the source viewer rather than buried in it.
 */
export function MarketplaceCapabilities(props: MarketplaceCapabilitiesProps) {
  const { t } = useTranslation()
  const allowedHosts = props.version?.allowedHosts
  const channelTypes = props.plugin.channelTypes

  return (
    <div className='space-y-2 rounded-md border p-3 text-sm'>
      <p className='font-medium'>{t('Declared capabilities')}</p>
      <dl className='grid gap-2 sm:grid-cols-2'>
        <div>
          <dt className='text-muted-foreground text-xs'>
            {t('Allowed hosts')}
          </dt>
          <dd className='font-mono text-xs break-all'>
            {allowedHosts?.length ? allowedHosts.join(', ') : t('Not declared')}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-xs'>
            {t('Channel types')}
          </dt>
          <dd className='text-xs'>
            {channelTypes?.length
              ? channelTypes
                  .map((type) => `${getChannelTypeLabel(type)} (#${type})`)
                  .join(', ')
              : t('Not declared')}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-xs'>
            {t('Authentication')}
          </dt>
          <dd className='font-mono text-xs'>
            {props.version?.auth || t('Not declared')}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-xs'>
            {t('Integrity hash')}
          </dt>
          <dd className='font-mono text-xs break-all'>
            {props.version?.sha256 ?? t('Not provided by this source')}
          </dd>
        </div>
      </dl>
      <p className='text-muted-foreground text-xs'>
        {t(
          'These values come from the source index and are shown for review only. The gateway admits the plugin based on the metadata compiled from its source.'
        )}
      </p>
    </div>
  )
}
