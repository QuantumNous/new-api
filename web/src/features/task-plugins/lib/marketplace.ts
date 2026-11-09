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
import i18next from 'i18next'

import type {
  MarketplaceIndex,
  MarketplaceIndexVersion,
  MarketplacePlugin,
  MarketplacePluginAuthor,
  MarketplacePluginIcon,
  MarketplaceRevokedEntry,
  MarketplaceSource,
  TaskPluginListItem,
} from '../types'
import { pluginProtocolClaimsSchema } from './plugin-meta-preview'
import { getPluginWebsite } from './plugin-website'

export const SUPPORTED_INDEX_VERSION = 1

/** The gateway only runs task plugins today; other kinds are filtered out. */
export const SUPPORTED_PLUGIN_KIND = 'task'

/**
 * Resolves a version's `path` against the index URL it was declared in, so the
 * same index works behind any raw prefix (GitHub raw, jsDelivr, a mirror).
 * Returns `null` when the path escapes to another origin or cannot be resolved.
 */
export function resolvePluginSourceUrl(
  indexUrl: string,
  path: string
): string | null {
  const trimmed = path.trim()
  if (!trimmed) return null
  let base: URL
  try {
    base = new URL(indexUrl)
  } catch {
    return null
  }
  let resolved: URL
  try {
    resolved = new URL(trimmed, base)
  } catch {
    return null
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    return null
  }
  // A relative path in an index must stay on the host that served the index;
  // an index that redirects source downloads elsewhere is not a source we can
  // reason about for integrity.
  if (resolved.origin !== base.origin) return null
  return resolved.toString()
}

/**
 * Validates an untrusted index payload into the display shape. Unknown fields
 * are dropped and malformed plugin entries are skipped rather than failing the
 * whole source, because the index is only a display cache — admission still
 * happens server-side on the compiled source.
 */
export function parseMarketplaceIndex(payload: unknown): MarketplaceIndex {
  if (!payload || typeof payload !== 'object') {
    throw new Error('index is not an object')
  }
  const raw = payload as Record<string, unknown>
  const indexVersion = Number(raw.indexVersion)
  if (!Number.isFinite(indexVersion)) {
    throw new Error('index is missing indexVersion')
  }
  if (indexVersion > SUPPORTED_INDEX_VERSION) {
    throw new Error(`unsupported indexVersion ${indexVersion}`)
  }
  const plugins: MarketplacePlugin[] = []
  if (Array.isArray(raw.plugins)) {
    for (const entry of raw.plugins) {
      const plugin = parseMarketplacePlugin(entry)
      if (plugin) plugins.push(plugin)
    }
  }
  return {
    indexVersion,
    name: typeof raw.name === 'string' ? raw.name : '',
    // Community lists put recommended plugins first, then the most installed.
    // An official index carries neither, so its order is unchanged.
    plugins: plugins.sort((left, right) => {
      if (Boolean(left.recommended) !== Boolean(right.recommended)) {
        return left.recommended ? -1 : 1
      }
      const installs = (right.installs30d ?? 0) - (left.installs30d ?? 0)
      if (installs !== 0) return installs
      const difference = (right.sortPriority ?? 0) - (left.sortPriority ?? 0)
      if (difference !== 0) return difference
      if (left.key === right.key) return 0
      return left.key < right.key ? -1 : 1
    }),
    revoked: parseRevokedEntries(raw.revoked),
  }
}

function parseRevokedEntries(value: unknown): MarketplaceRevokedEntry[] {
  if (!Array.isArray(value)) return []
  const entries: MarketplaceRevokedEntry[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    const sha256 =
      typeof raw.sha256 === 'string' ? raw.sha256.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(sha256)) continue
    entries.push({
      sha256,
      key: typeof raw.key === 'string' ? raw.key : undefined,
      reason: parseMarketplaceDescription(raw.reason),
    })
  }
  return entries
}

function parseMarketplaceAuthor(
  value: unknown
): MarketplacePluginAuthor | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const login = typeof raw.login === 'string' ? raw.login.trim() : ''
  if (!login || login.length > 64) return undefined
  return { login, url: getPluginWebsite(raw.url) }
}

function parseMarketplacePlugin(entry: unknown): MarketplacePlugin | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as Record<string, unknown>
  const key = typeof raw.key === 'string' ? raw.key.trim() : ''
  if (!key) return null

  const versions: MarketplaceIndexVersion[] = []
  if (Array.isArray(raw.versions)) {
    for (const candidate of raw.versions) {
      if (!candidate || typeof candidate !== 'object') continue
      const rawVersion = candidate as Record<string, unknown>
      const version =
        typeof rawVersion.version === 'string' ? rawVersion.version.trim() : ''
      const path =
        typeof rawVersion.path === 'string' ? rawVersion.path.trim() : ''
      if (!version || !path) continue
      const kind =
        typeof rawVersion.kind === 'string' ? rawVersion.kind.trim() : ''
      if (kind && kind !== SUPPORTED_PLUGIN_KIND) continue
      versions.push({
        version,
        path,
        sha256:
          typeof rawVersion.sha256 === 'string'
            ? rawVersion.sha256.trim()
            : undefined,
        minApiVersion: Number.isFinite(Number(rawVersion.minApiVersion))
          ? Number(rawVersion.minApiVersion)
          : undefined,
        kind: kind || undefined,
        allowedHosts: stringArray(rawVersion.allowedHosts),
        baseUrl:
          typeof rawVersion.baseUrl === 'string' && rawVersion.baseUrl.trim()
            ? rawVersion.baseUrl.trim()
            : undefined,
        auth: typeof rawVersion.auth === 'string' ? rawVersion.auth : undefined,
      })
    }
  }
  if (versions.length === 0) return null

  const declaredLatest = typeof raw.latest === 'string' ? raw.latest.trim() : ''
  const latest = versions.some((entry) => entry.version === declaredLatest)
    ? declaredLatest
    : versions[0].version

  // `icon` is a LobeHub name or the text scheme, exactly what meta.icon admits.
  // Inline data URIs and remote URLs are dropped: image logos ship as sidecar
  // files declared in `iconFile`, and are only ever loaded from the index's own
  // origin, so an index cannot turn the marketplace page into a beacon.
  let icon: string | undefined
  if (typeof raw.icon === 'string') {
    const trimmed = raw.icon.trim()
    if (
      trimmed &&
      trimmed.length <= 128 &&
      !trimmed.startsWith('data:') &&
      !trimmed.includes('://')
    ) {
      icon = trimmed
    }
  }
  let iconFile: MarketplacePluginIcon | undefined
  if (raw.iconFile && typeof raw.iconFile === 'object') {
    const rawIconFile = raw.iconFile as Record<string, unknown>
    const iconPath =
      typeof rawIconFile.path === 'string' ? rawIconFile.path.trim() : ''
    // Community files are named by their digest and carry no extension; the
    // logo fetch tells SVG from PNG by the bytes.
    if (/\.(svg|png)$/i.test(iconPath) || /\/[^./]+$/.test(iconPath)) {
      iconFile = {
        path: iconPath,
        sha256:
          typeof rawIconFile.sha256 === 'string'
            ? rawIconFile.sha256.trim()
            : undefined,
      }
    }
  }

  return {
    key,
    author: parseMarketplaceAuthor(raw.author),
    repo: getPluginWebsite(raw.repo),
    code:
      typeof raw.code === 'string' && raw.code.trim()
        ? raw.code.trim()
        : undefined,
    installs30d:
      typeof raw.installs30d === 'number' &&
      Number.isSafeInteger(raw.installs30d) &&
      raw.installs30d >= 0
        ? raw.installs30d
        : undefined,
    recommended: raw.recommended === true,
    sortPriority:
      typeof raw.sortPriority === 'number' &&
      Number.isInteger(raw.sortPriority) &&
      raw.sortPriority >= -2147483648 &&
      raw.sortPriority <= 2147483647
        ? raw.sortPriority
        : 0,
    website: getPluginWebsite(raw.website),
    name: typeof raw.name === 'string' && raw.name ? raw.name : key,
    icon,
    iconFile,
    description: parseMarketplaceDescription(raw.description),
    channelTypes: numberArray(raw.channelTypes),
    models: stringArray(raw.models),
    protocols: pluginProtocolClaimsSchema.safeParse(raw.protocols).data,
    // The parts the plugin has, named as in the plugin list; an index that
    // names none lists a task plugin.
    task: typeof raw.task === 'boolean' ? raw.task : undefined,
    provider: typeof raw.provider === 'boolean' ? raw.provider : undefined,
    transform: typeof raw.transform === 'boolean' ? raw.transform : undefined,
    latest,
    versions,
  }
}

function parseMarketplaceDescription(
  value: unknown
): string | Record<string, string> | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const mapped: Record<string, string> = {}
  for (const [locale, text] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (typeof text === 'string') mapped[locale] = text
  }
  return Object.keys(mapped).length > 0 ? mapped : undefined
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  if (!value.every((item) => typeof item === 'string' && item.length > 0)) {
    return undefined
  }
  return value
}

function numberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter(
    (item): item is number => typeof item === 'number' && Number.isFinite(item)
  )
  return items.length > 0 ? items : undefined
}

export function findMarketplaceVersion(
  plugin: MarketplacePlugin,
  version: string
): MarketplaceIndexVersion | undefined {
  return plugin.versions.find((entry) => entry.version === version)
}

export type InstallState =
  | { status: 'not_installed' }
  | { status: 'up_to_date'; installedVersion: string }
  | { status: 'upgradable'; installedVersion: string; latestVersion: string }
  | { status: 'diverged'; installedVersion: string; latestVersion: string }

/**
 * Compares a marketplace entry against the gateway's installed plugins.
 *
 * `diverged` covers the case where a plugin is installed at a version the index
 * does not list (locally uploaded, or the source rolled a version back): the UI
 * must not call that an upgrade, because installing would move the gateway to a
 * version it may already have moved away from deliberately.
 */
export function deriveInstallState(
  plugin: MarketplacePlugin,
  installed: TaskPluginListItem[]
): InstallState {
  const match = installed.find((item) => item.meta.key === plugin.key)
  if (!match) return { status: 'not_installed' }

  const installedVersion = match.meta.version
  if (installedVersion === plugin.latest) {
    return { status: 'up_to_date', installedVersion }
  }
  const known = plugin.versions.some(
    (entry) => entry.version === installedVersion
  )
  if (!known) {
    return {
      status: 'diverged',
      installedVersion,
      latestVersion: plugin.latest,
    }
  }
  return {
    status: 'upgradable',
    installedVersion,
    latestVersion: plugin.latest,
  }
}

/**
 * Built-in version shown next to the marketplace latest. Factory-served items
 * do not carry `factory_meta` (their `meta` *is* the factory meta); overridden
 * factory plugins expose the shadowed built-in on `factory_meta`.
 */
export function marketplaceBuiltInVersion(
  installed?: TaskPluginListItem
): string | undefined {
  if (!installed) return undefined
  if (installed.source === 'factory') return installed.meta.version
  return installed.factory_meta?.version
}

export function isStaleFactoryOverride(item: TaskPluginListItem): boolean {
  return (
    item.source === 'override_over_factory' &&
    item.factory_meta != null &&
    item.factory_meta.version !== item.meta.version
  )
}

/**
 * A source is only integrity-checked when every listed version carries a
 * sha256. Anything less and installs from it cannot be pinned, so the UI warns.
 */
export function indexHasIntegrityHashes(index: MarketplaceIndex): boolean {
  return (
    index.plugins.length > 0 &&
    index.plugins.every((plugin) =>
      plugin.versions.every((version) => Boolean(version.sha256))
    )
  )
}

export const DEFAULT_MARKETPLACE_INDEX_URL =
  'https://www.newapi.ai/api/v1/plugins/index.json'

export const GITHUB_MARKETPLACE_INDEX_URL =
  'https://raw.githubusercontent.com/QuantumNous/new-api-plugins/main/index.json'

export const COMMUNITY_MARKETPLACE_INDEX_URL =
  'https://www.newapi.ai/api/v1/community/index.json'

export type MarketplaceSourceKind = 'official' | 'community' | 'third_party'

/**
 * The gateway's rule: the built-in official addresses are official, the
 * built-in community address is community, and every other source is third
 * party. What an index says about itself does not count.
 */
export function marketplaceSourceKind(indexUrl: string): MarketplaceSourceKind {
  const normalized = indexUrl.trim()
  if (
    normalized === DEFAULT_MARKETPLACE_INDEX_URL ||
    normalized === GITHUB_MARKETPLACE_INDEX_URL
  ) {
    return 'official'
  }
  if (normalized === COMMUNITY_MARKETPLACE_INDEX_URL) return 'community'
  return 'third_party'
}

/** Fetches a marketplace index from the browser. */
export async function fetchMarketplaceIndex(
  indexUrl: string
): Promise<MarketplaceIndex> {
  // Revalidate so the hashes checked at install time are the host's current
  // ones rather than a copy cached before a republish.
  const response = await fetch(indexUrl, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(
      i18next.t('The source returned HTTP {{status}}', {
        status: response.status,
      })
    )
  }
  return parseMarketplaceIndex(await response.json())
}

/**
 * Looks up a community plugin by its 8-digit code. Returns null
 * when no listed plugin has that code. The answer has the shape of the index,
 * so its file paths resolve against the community index address.
 */
export async function resolveCommunityPlugin(
  code: string
): Promise<MarketplacePlugin | null> {
  const url = new URL('resolve', COMMUNITY_MARKETPLACE_INDEX_URL)
  url.searchParams.set('code', code.trim())
  const response = await fetch(url, { cache: 'no-cache' })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(
      i18next.t('The source returned HTTP {{status}}', {
        status: response.status,
      })
    )
  }
  return parseMarketplaceIndex(await response.json()).plugins[0] ?? null
}

/**
 * Finds a plugin by its 8-digit code: the official indexes first, then the
 * community site. Null when no plugin has the code.
 */
export async function findPluginByCode(
  code: string,
  officialSources: MarketplaceSource[],
  communitySource: MarketplaceSource | undefined
): Promise<{ source: MarketplaceSource; plugin: MarketplacePlugin } | null> {
  const wanted = code.trim()
  let failure: unknown = null
  for (const source of officialSources) {
    try {
      const index = await fetchMarketplaceIndex(source.index_url)
      const plugin = index.plugins.find((item) => item.code === wanted)
      if (plugin) return { source, plugin }
    } catch (error) {
      failure = error
    }
  }
  if (communitySource) {
    const plugin = await resolveCommunityPlugin(wanted)
    if (plugin) return { source: communitySource, plugin }
  }
  if (failure) throw failure
  return null
}

/** The takedown entry for an installed plugin's source, if the index lists one. */
export function findRevokedEntry(
  index: MarketplaceIndex | undefined,
  sourceHash: string | undefined
): MarketplaceRevokedEntry | undefined {
  const hash = sourceHash?.trim().toLowerCase()
  if (!hash) return undefined
  return index?.revoked?.find((entry) => entry.sha256 === hash)
}
