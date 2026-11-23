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
import type { QueryClient } from '@tanstack/react-query'
import i18next from 'i18next'

import { MODEL_PRICING_ISSUES_QUERY_KEY } from '@/features/system-settings/models/pricing-issues'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { activateTaskPlugin, installMarketplacePlugin } from '../api'
import type {
  MarketplaceIndexVersion,
  MarketplacePlugin,
  MarketplaceSource,
} from '../types'
import { resolvePluginSourceUrl } from './marketplace'
import { fetchPluginIconDataUri } from './plugin-icon-file'
import {
  computeSourceSha256,
  fetchPluginSourceText,
  PluginSourceFetchError,
} from './plugin-url'

export async function downloadMarketplaceRelease(
  source: MarketplaceSource,
  plugin: MarketplacePlugin,
  entry: MarketplaceIndexVersion
) {
  const url = resolvePluginSourceUrl(source.index_url, entry.path)
  if (!url) {
    throw new Error(
      i18next.t('The source gives an invalid address for this plugin.')
    )
  }
  const text = await fetchPluginSourceText(url)
  const iconUrl =
    plugin.iconFile &&
    resolvePluginSourceUrl(source.index_url, plugin.iconFile.path)
  const [digest, icon] = await Promise.all([
    computeSourceSha256(text),
    iconUrl
      ? fetchPluginIconDataUri(iconUrl, { sha256: plugin.iconFile?.sha256 })
      : null,
  ])
  return { text, digest, icon }
}

export class MarketplaceActivationError extends Error {}

export function marketplaceErrorMessage(error: unknown) {
  if (error instanceof PluginSourceFetchError) {
    return error.reason === 'too_large'
      ? i18next.t('Plugin source exceeds the 8 MiB limit.')
      : i18next.t('Could not download the plugin code. Try again later.')
  }
  return getServerErrorMessage(error)
}

export async function installMarketplaceRelease(
  source: MarketplaceSource,
  entry: MarketplaceIndexVersion,
  download: Awaited<ReturnType<typeof downloadMarketplaceRelease>>
) {
  if (
    entry.sha256 &&
    download.digest &&
    entry.sha256.toLowerCase() !== download.digest.toLowerCase()
  ) {
    throw new Error(i18next.t('Integrity check failed'))
  }
  const detail = await installMarketplacePlugin({
    source: download.text,
    sourceSha256: entry.sha256,
    remark: `${source.name} v${entry.version}`,
    icon: download.icon ?? undefined,
    marketplaceIndexUrl: source.index_url,
  })
  if (!detail.plugin || detail.plugin.active) return detail

  try {
    const notice = await activateTaskPlugin(
      detail.meta.key,
      detail.meta.version
    )
    return { ...detail, pricing_issues: notice?.pricing_issues ?? [] }
  } catch (error) {
    throw new MarketplaceActivationError(getServerErrorMessage(error), {
      cause: error,
    })
  }
}

export function invalidateMarketplaceInstalls(
  client: QueryClient,
  keys: string[]
) {
  void client.invalidateQueries({ queryKey: ['task-plugins'] })
  void client.invalidateQueries({ queryKey: MODEL_PRICING_ISSUES_QUERY_KEY })
  for (const key of keys) {
    void client.invalidateQueries({ queryKey: ['task-plugin', key] })
    void client.invalidateQueries({ queryKey: ['task-plugin-versions', key] })
  }
}
