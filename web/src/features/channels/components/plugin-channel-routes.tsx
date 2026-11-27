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
import { ArrowRight, Route, Shuffle } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import type { PluginRelayRoute } from '../api'
import type { ChannelFormValues } from '../lib/channel-form'
import {
  nextPluginRouteToggles,
  pluginRouteConverterLabel,
} from '../lib/plugin-routes'

type PluginChannelRoutesProps = {
  routes: PluginRelayRoute[]
  disabled?: boolean
}

/**
 * The relay routes of the bound plugin, each with a switch that turns it on
 * or off for this channel. The switches are kept in plugin_routes.
 */
export function PluginChannelRoutes(props: PluginChannelRoutesProps) {
  const { t } = useTranslation()
  const form = useFormContext<ChannelFormValues>()
  const toggles = useWatch({ control: form.control, name: 'plugin_routes' })
  const isOn = (route: PluginRelayRoute) =>
    toggles?.[route.key] ?? route.default_enabled
  const onCount = props.routes.filter(isOn).length

  return (
    <div role='group' aria-label={t('Plugin routes')} className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Route
            className='text-muted-foreground size-3.5'
            aria-hidden='true'
          />
          <h4 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            {t('Plugin routes')}
          </h4>
        </div>
        <Badge variant='secondary'>
          {t('{{on}} of {{total}} on', {
            on: onCount,
            total: props.routes.length,
          })}
        </Badge>
      </div>
      <ul className='divide-y rounded-xl border'>
        {props.routes.map((route) => {
          const converter = route.converter?.trim() ?? ''
          const native = converter === '' || converter === 'none'
          const on = isOn(route)
          return (
            <li
              key={route.key}
              className='flex items-center justify-between gap-3 px-4 py-3'
            >
              <div className={cn('min-w-0 space-y-1.5', !on && 'opacity-50')}>
                <div className='flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm'>
                  <span className='break-all'>{route.incoming_path}</span>
                  <ArrowRight
                    className='text-muted-foreground size-3.5 shrink-0'
                    aria-hidden='true'
                  />
                  <span className='text-muted-foreground break-all'>
                    {route.upstream_path}
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <Badge variant={native ? 'secondary' : 'outline'}>
                    {native ? (
                      <ArrowRight aria-hidden='true' />
                    ) : (
                      <Shuffle aria-hidden='true' />
                    )}
                    {t(pluginRouteConverterLabel(converter))}
                  </Badge>
                  <Badge variant='outline' className='font-normal'>
                    {route.models?.length
                      ? route.models.join(', ')
                      : t('All models')}
                  </Badge>
                </div>
              </div>
              <Switch
                checked={on}
                disabled={props.disabled}
                aria-label={
                  route.models?.length
                    ? `${route.incoming_path} (${route.models.join(', ')})`
                    : route.incoming_path
                }
                onCheckedChange={(checked) =>
                  form.setValue(
                    'plugin_routes',
                    nextPluginRouteToggles(
                      props.routes,
                      toggles ?? {},
                      route.key,
                      checked
                    ),
                    { shouldDirty: true }
                  )
                }
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
