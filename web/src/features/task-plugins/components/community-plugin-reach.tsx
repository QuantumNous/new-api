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
import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import {
  parsePluginMetaPreview,
  readPluginSourceParts,
  resolvePluginMetaPreview,
} from '../lib/plugin-meta-preview'
import { resolvePluginParts } from '../lib/plugin-parts'
import type { MarketplaceIndexVersion, MarketplacePlugin } from '../types'

type CommunityPluginReachProps = {
  plugin: MarketplacePlugin
  version?: MarketplaceIndexVersion
  /** The downloaded code; until it arrives the source's own claims are used. */
  source?: string
}

function hostOf(address: string) {
  try {
    return new URL(address).host
  } catch {
    return ''
  }
}

/** What a plugin from a community or third-party source can reach once installed. */
export function CommunityPluginReach(props: CommunityPluginReachProps) {
  const { t } = useTranslation()
  const read = useMemo(() => {
    if (props.source === undefined) return undefined
    return {
      parts: readPluginSourceParts(props.source),
      preview: parsePluginMetaPreview(props.source),
    }
  }, [props.source])
  const fields = resolvePluginMetaPreview(
    props.plugin,
    props.version,
    read?.preview
  )
  // Code that cannot be read may hold any part, so every line shows.
  let parts = { task: true, provider: true, transform: true }
  if (read?.parts) parts = read.parts
  if (!read) parts = resolvePluginParts({ ...props.plugin, meta: props.plugin })

  const lines: string[] = []
  if (parts.task || parts.provider) {
    lines.push(t('The keys and API addresses of the channels that use it'))
  }
  if (parts.transform) {
    lines.push(t('The requests and replies it handles'))
  }
  const hosts = new Set<string>()
  if (fields.baseUrl.state === 'value' && fields.baseUrl.value) {
    const host = hostOf(fields.baseUrl.value)
    if (host) hosts.add(host)
  }
  if (fields.allowedHosts.state === 'value') {
    for (const host of fields.allowedHosts.value) hosts.add(host)
  }
  if (hosts.size > 0) {
    lines.push(
      t('Other addresses: {{hosts}}', { hosts: [...hosts].join(', ') })
    )
  }
  if (fields.allowedHosts.state === 'unknown') {
    lines.push(t('Other addresses: could not be read from the code'))
  }

  return (
    <Alert className='border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400'>
      <AlertTriangle />
      <AlertTitle>{t('What this plugin can reach')}</AlertTitle>
      <AlertDescription className='text-foreground'>
        <ul className='list-disc space-y-0.5 pl-4 break-words'>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
