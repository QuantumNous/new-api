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

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { ADVANCED_CUSTOM_CONVERTER_OPTIONS } from '@/features/channels/lib/advanced-custom'

import type { TaskPluginRelayRoute } from '../types'
import { PluginModelList } from './plugin-model-list'

/** i18n key for a route converter; unknown converters are shown verbatim. */
function converterLabelKey(converter?: string) {
  const value = converter?.trim() ?? ''
  if (value === '' || value === 'none') return 'Native forwarding'
  if (value === 'plugin') return 'Converted by the plugin'
  return ADVANCED_CUSTOM_CONVERTER_OPTIONS.find(
    (option) => option.value === value
  )?.label
}

/**
 * The client API paths a provider plugin forwards, each with the upstream path
 * it reaches, how the request format is converted, and its model scope.
 */
export function PluginRelayRoutes(props: { routes: TaskPluginRelayRoute[] }) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold'>{t('Forwarded routes')}</h3>
      <ul className='divide-y'>
        {props.routes.map((route) => {
          const labelKey = converterLabelKey(route.converter)
          return (
            <li
              key={route.incoming_path}
              className='grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-2'
            >
              <dl className='min-w-0 space-y-1.5 pt-1 text-xs'>
                <div className='flex min-w-0 flex-wrap items-baseline gap-x-2'>
                  <dt className='text-muted-foreground'>
                    {t('Incoming path')}
                  </dt>
                  <dd className='min-w-0 font-mono break-all'>
                    {route.incoming_path}
                  </dd>
                </div>
                <div className='flex min-w-0 flex-wrap items-baseline gap-x-2'>
                  <dt className='text-muted-foreground'>
                    {t('Upstream path')}
                  </dt>
                  <dd className='min-w-0 font-mono break-all'>
                    {route.upstream_path}
                  </dd>
                </div>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <dt className='sr-only'>{t('Converter')}</dt>
                  <dd>
                    <Badge variant='secondary' className='font-normal'>
                      {labelKey ? t(labelKey) : route.converter}
                    </Badge>
                  </dd>
                  {route.models?.length ? (
                    <dd>
                      <PluginModelList
                        models={route.models}
                        collapsedLabel={t('Model scope')}
                      />
                    </dd>
                  ) : null}
                </div>
              </dl>
              <CopyButton
                value={route.incoming_path}
                className='size-7'
                iconClassName='size-3.5'
                aria-label={t('Copy endpoint path')}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
