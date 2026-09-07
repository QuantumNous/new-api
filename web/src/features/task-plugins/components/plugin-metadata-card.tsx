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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { HOST_PROTOCOL_ENDPOINTS } from '../lib/host-protocols'
import type { TaskPluginMeta, TaskPluginRoute } from '../types'

type PluginMetadataCardProps = {
  meta: TaskPluginMeta
}

/**
 * Marks a protocol claim or native route that binds only a subset of
 * `meta.models`. The subset can be long enough to dominate the section, so the
 * members stay in the title tooltip and only the marker is laid out.
 */
function ModelScopeHint(props: { models: string[] }) {
  const { t } = useTranslation()
  return (
    <span
      className='text-muted-foreground text-[11px]'
      title={props.models.join(', ')}
    >
      {t('Model scope')}
    </span>
  )
}

/**
 * One HTTP endpoint the gateway serves for this plugin. Methods and paths are
 * wire vocabulary and stay raw; `children` carries the trailing annotations
 * (supported request forms, native route type) that belong to this endpoint.
 */
function EndpointRow(props: {
  method: string
  path: string
  children?: ReactNode
}) {
  return (
    <li className='flex flex-wrap items-center gap-x-2 gap-y-1'>
      <Badge variant='outline' className='shrink-0 font-mono font-normal'>
        {props.method}
      </Badge>
      <span className='min-w-0 font-mono text-xs break-all' title={props.path}>
        {props.path}
      </span>
      {props.children}
    </li>
  )
}

/**
 * The endpoints a plugin exposes: first the host protocol endpoints derived
 * from each `meta.protocols` claim, then the native routes it declares itself.
 *
 * The supported request forms of a mode-bearing protocol are rendered on the
 * create endpoint rather than next to the protocol name, because `supports`
 * gates exactly that call — retrieval of a created resource is always
 * available. Mode names are wire vocabulary and are never translated.
 */
function PluginEndpoints(props: {
  protocols?: TaskPluginMeta['protocols']
  routes?: TaskPluginRoute[]
}) {
  const { t } = useTranslation()
  const claims = props.protocols ?? []
  const routes = props.routes ?? []

  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-xs font-medium'>
        {t('Endpoints')}
      </p>
      {claims.length === 0 && routes.length === 0 ? (
        <p className='text-muted-foreground text-xs'>—</p>
      ) : null}
      {claims.map((claim) => {
        const name = typeof claim === 'string' ? claim : claim.name
        const supports = typeof claim === 'string' ? undefined : claim.supports
        const models = typeof claim === 'string' ? undefined : claim.models
        const endpoints = HOST_PROTOCOL_ENDPOINTS[name] ?? []
        const chips = supports?.map((mode) => (
          <Badge
            key={mode}
            variant='secondary'
            className='font-mono font-normal'
          >
            {mode}
          </Badge>
        ))
        // Chips belong on the create row, but a claim naming a protocol absent
        // from the frozen table has no rows at all; keep the declared forms
        // visible on the group header rather than dropping them silently.
        const hasCreateRow = endpoints.some((endpoint) => endpoint.modeBearing)
        return (
          <div key={name} className='space-y-1.5'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='text-muted-foreground font-mono text-xs'>
                {name}
              </span>
              {models?.length ? <ModelScopeHint models={models} /> : null}
              {hasCreateRow ? null : chips}
            </div>
            <ul className='space-y-1.5 pl-3'>
              {endpoints.map((endpoint) => (
                <EndpointRow
                  key={`${endpoint.method} ${endpoint.path}`}
                  method={endpoint.method}
                  path={endpoint.path}
                >
                  {endpoint.modeBearing ? chips : null}
                </EndpointRow>
              ))}
            </ul>
          </div>
        )
      })}
      {routes.length > 0 ? (
        <div className='space-y-1.5'>
          <p className='text-muted-foreground text-xs'>{t('Native routes')}</p>
          <ul className='space-y-1.5 pl-3'>
            {routes.map((route) => (
              <EndpointRow
                key={`${route.method} ${route.path}`}
                method={route.method}
                path={route.path}
              >
                <span className='text-muted-foreground font-mono text-[11px]'>
                  {route.type}
                </span>
                {route.models?.length ? (
                  <ModelScopeHint models={route.models} />
                ) : null}
              </EndpointRow>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The manifest facts an administrator checks before binding a channel: the
 * scalar declarations, then every endpoint the gateway serves for this plugin.
 * Labels are translated; manifest values stay raw and monospaced so they can be
 * compared against the plugin source verbatim.
 */
export function PluginMetadataCard(props: PluginMetadataCardProps) {
  const { t } = useTranslation()
  const fields: { label: string; value: string; wide?: boolean }[] = [
    { label: t('Version'), value: props.meta.version },
    { label: t('API version'), value: String(props.meta.apiVersion) },
    {
      label: t('Channel types'),
      value: props.meta.channelTypes?.join(', ') ?? '',
    },
    { label: t('Fetch mode'), value: props.meta.fetchMode },
    {
      label: t('Models'),
      value: props.meta.models?.join(', ') ?? '',
      wide: true,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Plugin metadata')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <dl className='grid gap-x-4 gap-y-3 sm:grid-cols-2'>
          {fields.map((field) => (
            <div
              key={field.label}
              className={field.wide ? 'sm:col-span-2' : ''}
            >
              <dt className='text-muted-foreground text-xs'>{field.label}</dt>
              <dd className='font-mono text-xs break-words'>
                {field.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
        <div className='border-t pt-4'>
          <PluginEndpoints
            protocols={props.meta.protocols}
            routes={props.meta.routes}
          />
        </div>
      </CardContent>
    </Card>
  )
}
