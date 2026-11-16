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

import type { TaskPluginOption } from '@/features/channels/api'
import { cn } from '@/lib/utils'

import type { PluginIconInput } from '../lib/plugin-icon'
import { REQUEST_PLUGIN_STAGE_LABELS } from '../lib/request-plugins'
import { PluginIcon } from './plugin-icon'

/** A plugin's icon on a soft tile, as the instance editor shows it. */
export function RequestPluginIconTile(props: {
  plugin: PluginIconInput
  size?: 'md' | 'lg'
}) {
  const large = props.size === 'lg'
  return (
    <span
      aria-hidden='true'
      className={cn(
        'bg-muted/70 ring-foreground/5 grid shrink-0 place-items-center rounded-xl ring-1',
        large ? 'size-12' : 'size-11'
      )}
    >
      <PluginIcon plugin={props.plugin} size={large ? 28 : 24} />
    </span>
  )
}

/** When a request processing plugin runs, and what a failure of it does. */
export function RequestPluginRunLine(props: {
  plugin: TaskPluginOption
  className?: string
}) {
  const { t } = useTranslation()
  const hooks = props.plugin.transform_hooks ?? []
  // Only the request stages can refuse a request: a reply check that fails
  // stops the answer, and a report holds nothing up. A plugin without its
  // stages listed is taken to change requests.
  const checksRequest =
    hooks.length === 0 ||
    hooks.some((hook) => hook !== 'reply' && hook !== 'report')
  const checksReply = hooks.includes('reply')
  let failure: string | null = null
  if (checksRequest || checksReply) {
    if (props.plugin.optional) failure = t('Skipped when it fails')
    else if (checksRequest) failure = t('Refuses the request when it fails')
    else failure = t('Stops the reply when it fails')
  }
  return (
    <span
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal',
        props.className
      )}
    >
      {hooks.map((hook, index) => (
        <span
          key={hook}
          className={cn(
            (failure || index < hooks.length - 1) &&
              "after:ml-2 after:content-['·']"
          )}
        >
          {t(REQUEST_PLUGIN_STAGE_LABELS[hook] ?? hook)}
        </span>
      ))}
      {failure && (
        <span className='inline-flex items-center gap-1.5'>
          <span
            aria-hidden='true'
            className={cn(
              'size-1.5 rounded-full',
              props.plugin.optional ? 'bg-success' : 'bg-warning'
            )}
          />
          {failure}
        </span>
      )}
    </span>
  )
}
