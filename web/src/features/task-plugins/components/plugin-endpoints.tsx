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
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

import { HOST_PROTOCOL_ENDPOINTS } from '../lib/host-protocols'
import type { TaskPluginMeta, TaskPluginRoute } from '../types'
import { PluginModelList } from './plugin-model-list'

/**
 * One HTTP endpoint the gateway serves for this plugin. Methods and paths are
 * wire vocabulary and stay raw; `children` carries the trailing annotations
 * (supported request forms, native route type) that belong to this endpoint.
 */
function EndpointRow(props: {
  method: string
  path: string
  muted?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <li className='grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-2 py-2'>
      <Badge
        variant='outline'
        className='mt-1 justify-center font-mono font-normal'
      >
        {props.method}
      </Badge>
      <div className='min-w-0 space-y-1.5 pt-1'>
        <span
          className={cn(
            'block font-mono text-xs break-all',
            props.muted && 'text-muted-foreground'
          )}
        >
          {props.path}
        </span>
        <div className='flex flex-wrap items-center gap-1.5'>
          {props.children}
        </div>
      </div>
      <CopyButton
        value={props.path}
        className='size-7'
        iconClassName='size-3.5'
        aria-label={t('Copy endpoint path')}
      />
    </li>
  )
}

/**
 * The address under /{key} at which the gateway also serves a declared route,
 * which always reaches this plugin. A route whose first segment is the key or
 * a proper prefix of it (alibaba's /ali, sunoapi's /suno) is already the
 * plugin's own address and has none.
 */
function keyAddress(pluginKey: string | undefined, path: string) {
  const first = path.split('/')[1] ?? ''
  if (!pluginKey || (first !== '' && pluginKey.startsWith(first))) {
    return undefined
  }
  return `/${pluginKey}${path}`
}

/**
 * One route the plugin declares itself, at its declared path or, when
 * `showKeyAddress` is set, at its /{key} address. A declared path the gateway
 * leaves to the /{key} address (`skippedRoutes`, as "METHOD /path") is shown
 * muted wherever it is the path displayed.
 */
function DeclaredRouteRow(props: {
  route: TaskPluginRoute
  pluginKey?: string
  skippedRoutes?: string[]
  showKeyAddress?: boolean
}) {
  const { t } = useTranslation()
  const pinnedPath = keyAddress(props.pluginKey, props.route.path)
  const path =
    props.showKeyAddress && pinnedPath ? pinnedPath : props.route.path
  const muted =
    path === props.route.path &&
    props.skippedRoutes?.includes(`${props.route.method} ${props.route.path}`)
  return (
    <EndpointRow method={props.route.method} path={path} muted={muted}>
      <span className='text-muted-foreground text-xs'>
        {props.route.type === 'submit' && t('Submit request')}
        {props.route.type === 'query' && t('Retrieve result')}
        {props.route.type === 'dynamic' && t('Dynamic operation')}
      </span>
      {props.route.models?.length ? (
        <PluginModelList
          models={props.route.models}
          collapsedLabel={t('Model scope')}
        />
      ) : null}
      {muted && pinnedPath ? (
        <span className='text-muted-foreground text-xs'>
          {t('Only served at the /{{key}} address', { key: props.pluginKey })}
        </span>
      ) : null}
    </EndpointRow>
  )
}

/**
 * The endpoints a plugin exposes: first the host protocol endpoints derived
 * from each `meta.protocols` claim, then the native routes it declares itself.
 *
 * Each native route is listed once, by its declared path; a toggle switches
 * every path that has a /{key} address to that address. Once a plugin declares
 * paths outside its own prefix (the vendor's official paths), its routes under
 * that prefix are the older addresses kept working and are folded at the end.
 *
 * The supported request forms of a mode-bearing protocol are rendered on the
 * create endpoint rather than next to the protocol name, because `supports`
 * gates exactly that call — retrieval of a created resource is always
 * available. Mode names are wire vocabulary and are never translated.
 */
export function PluginEndpoints(props: {
  title?: ReactNode
  protocolsNote?: ReactNode
  routesNote?: ReactNode
  protocols?: TaskPluginMeta['protocols']
  routes?: TaskPluginRoute[]
  pluginKey?: string
  skippedRoutes?: string[]
}) {
  const { t } = useTranslation()
  const [showKeyAddresses, setShowKeyAddresses] = useState(false)
  const claims = props.protocols ?? []
  const routes = props.routes ?? []
  const vendorRoutes = routes.filter((route) =>
    keyAddress(props.pluginKey, route.path)
  )
  const legacyRoutes = vendorRoutes.length
    ? routes.filter((route) => !keyAddress(props.pluginKey, route.path))
    : []

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold'>{props.title ?? t('Endpoints')}</h3>
      {claims.length === 0 &&
      routes.length === 0 &&
      !props.protocolsNote &&
      !props.routesNote ? (
        <p className='text-muted-foreground text-sm'>{t('Not declared')}</p>
      ) : null}
      {props.protocolsNote}
      {claims.length > 0 && (
        <p className='text-xs font-medium'>
          {t('Standard protocol interfaces')}
        </p>
      )}
      {claims.map((claim) => {
        const name = typeof claim === 'string' ? claim : claim.name
        const supports = typeof claim === 'string' ? undefined : claim.supports
        const models = typeof claim === 'string' ? undefined : claim.models
        const endpoints = HOST_PROTOCOL_ENDPOINTS[name] ?? []
        const modeLabels = {
          stream: t('Streaming'),
          sync: t('Synchronous'),
          background: t('Background'),
        }
        const chips = supports?.map((mode) => (
          <Badge
            key={mode}
            variant='secondary'
            className='font-mono font-normal'
          >
            <span>{mode}</span>
            <span className='font-sans'>{modeLabels[mode]}</span>
          </Badge>
        ))
        // Chips belong on the create row, but a claim naming a protocol absent
        // from the frozen table has no rows at all; keep the declared forms
        // visible on the group header rather than dropping them silently.
        const hasCreateRow = endpoints.some((endpoint) => endpoint.modeBearing)
        return (
          <div key={name} className='bg-muted/30 space-y-1.5 rounded-md p-3'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='text-muted-foreground min-w-0 font-mono text-xs break-all'>
                {name}
              </span>
              {models?.length ? (
                <PluginModelList
                  models={models}
                  collapsedLabel={t('Model scope')}
                />
              ) : null}
              {hasCreateRow ? null : chips}
            </div>
            <ul className='divide-y'>
              {endpoints.map((endpoint) => (
                <EndpointRow
                  key={`${endpoint.method} ${endpoint.path}`}
                  method={endpoint.method}
                  path={endpoint.path}
                >
                  <span className='text-muted-foreground text-xs'>
                    {endpoint.method === 'POST'
                      ? t('Submit request')
                      : t('Retrieve result')}
                  </span>
                  {endpoint.modeBearing ? chips : null}
                </EndpointRow>
              ))}
            </ul>
          </div>
        )
      })}
      {props.routesNote}
      {routes.length > 0 ? (
        <div className='bg-muted/30 space-y-1.5 rounded-md p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              {t('Plugin-defined interfaces')}
            </p>
            {vendorRoutes.length > 0 && (
              <ToggleGroup
                value={[showKeyAddresses ? 'key' : 'vendor']}
                onValueChange={(value) => {
                  // Pressing the selected form again keeps it selected.
                  if (value.length) setShowKeyAddresses(value[0] === 'key')
                }}
                aria-label={t('Address format')}
                variant='outline'
                size='sm'
              >
                <ToggleGroupItem value='vendor'>
                  {t('Vendor path')}
                </ToggleGroupItem>
                <ToggleGroupItem value='key' className='font-mono'>
                  /{props.pluginKey}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <ul className='divide-y'>
            {(vendorRoutes.length ? vendorRoutes : routes).map((route) => (
              <DeclaredRouteRow
                key={`${route.method} ${route.path}`}
                route={route}
                pluginKey={props.pluginKey}
                skippedRoutes={props.skippedRoutes}
                showKeyAddress={showKeyAddresses}
              />
            ))}
          </ul>
          {legacyRoutes.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger
                render={
                  <Button
                    variant='ghost'
                    size='sm'
                    className='group h-auto gap-1 px-1 py-1 text-xs'
                  />
                }
              >
                {t('Legacy addresses ({{count}})', {
                  count: legacyRoutes.length,
                })}
                <ChevronDown
                  className='size-3 transition-transform group-aria-expanded:rotate-180'
                  aria-hidden='true'
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className='divide-y'>
                  {legacyRoutes.map((route) => (
                    <DeclaredRouteRow
                      key={`${route.method} ${route.path}`}
                      route={route}
                      pluginKey={props.pluginKey}
                      skippedRoutes={props.skippedRoutes}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      ) : null}
    </div>
  )
}
