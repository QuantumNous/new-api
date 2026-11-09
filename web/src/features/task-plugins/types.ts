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
import type {
  BillingUsageSchema,
  BillingUsageExample,
} from '@/features/pricing/types'
import type { ModelPricingIssue } from '@/features/system-settings/models/pricing-issues'
import type { RequestPluginRecordItem } from '@/features/usage-logs/types'
import type { LocalizedTextValue } from '@/lib/localized-text'

export type TaskPluginProtocolClaim =
  | string
  | {
      name: string
      models?: string[]
      supports?: ('stream' | 'sync' | 'background')[]
    }

/**
 * One native route declared by `meta.routes` (backend `jsplugin.Route`). Only
 * the fields the admin UI renders are typed; hook bindings such as `decode`,
 * `render` and `action` are implementation detail of the plugin.
 */
export type TaskPluginRoute = {
  method: string
  path: string
  type: 'submit' | 'query' | 'dynamic'
  models?: string[]
}

/**
 * One relay route of a provider plugin (`meta.relay`), keyed like an Advanced
 * Custom channel route. `converter: "plugin"` means the plugin converts it.
 */
export type TaskPluginRelayRoute = {
  incoming_path: string
  upstream_path: string
  converter?: string
  models?: string[]
}

export type TaskPluginMeta = {
  sortPriority?: number
  website?: string
  apiVersion: number
  key: string
  name: string
  /** The name in other languages; `name` is the fallback. */
  name_i18n?: LocalizedTextValue
  icon?: string
  description?: Record<string, string>
  version: string
  author: {
    name: string
    url?: string
  }
  baseUrl?: string
  channelTypes?: number[] | null
  models: string[] | null
  fetchMode: string
  routes?: TaskPluginRoute[]
  protocols?: TaskPluginProtocolClaim[]
  relay?: TaskPluginRelayRoute[]
  usageSchema?: BillingUsageSchema
  usageProfiles?: {
    models: string[]
    schema: BillingUsageSchema
    examples?: BillingUsageExample[]
  }[]
  /** The schema of a request processing instance's config. */
  configSchema?: RequestPluginConfigSchema
}

/** One field of `meta.configSchema`, the subset the gateway validates. */
export type RequestPluginConfigField = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  title: LocalizedTextValue
  description?: LocalizedTextValue
  default?: unknown
  examples?: unknown[]
  enum?: (string | number)[]
  enumTitles?: LocalizedTextValue[]
  minimum?: number
  maximum?: number
  /** Display unit of a number; byte values are entered in B, KB or MB. */
  unit?: 'byte' | 'pixel' | 'character' | 'second'
  /**
   * The field shows only while every listed sibling holds one of its
   * values. A hidden field keeps its value.
   */
  visibleWhen?: Record<string, (string | number | boolean)[]>
  minLength?: number
  maxLength?: number
  pattern?: string
  /** keywords is a keyword list, one per line, edited like textarea. */
  format?: 'textarea' | 'keywords' | 'regex' | 'json' | 'url' | 'password'
  items?: RequestPluginConfigField
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  properties?: Record<string, RequestPluginConfigField>
  required?: string[]
  /**
   * A value per model: an object without `properties` whose keys are model
   * names and whose values all follow this scalar field.
   */
  additionalProperties?: RequestPluginConfigField
}

export type RequestPluginConfigSchema = {
  type: 'object'
  properties: Record<string, RequestPluginConfigField>
  required?: string[]
}

/**
 * One configured use of a request processing plugin. `global` and `groups`
 * are its own scope; channels bind instances by id. `models` limits it to the
 * models clients ask for; empty means every model.
 */
export type RequestPluginInstance = {
  id: string
  name: string
  plugin: string
  enabled: boolean
  global: boolean
  groups: string[]
  models: string[]
  config: Record<string, unknown>
}

/**
 * A request a plugin offers for trying it out. The body is text only: the
 * string "[sample-image]" as an item of a content or parts list stands for
 * the console's own sample image.
 */
export type RequestPluginSample = {
  name: LocalizedTextValue
  /** The base language of its text, such as "en" or "zh"; absent fits any. */
  lang?: string
  format: 'openai' | 'openai_responses' | 'claude' | 'gemini'
  body: Record<string, unknown>
  /** An answer from the model, for plugins that check replies. */
  reply?: string
}

export type RequestPluginDryRunRequest = {
  format: string
  path?: string
  model: string
  group?: string
  channel_id?: number
  body: unknown
  /** An unsaved instance to run alone instead of the saved ones. */
  instance?: RequestPluginInstance
  /** An answer from the model for the reply checks to read. */
  reply?: string
}

export type RequestPluginDryRunStep = {
  instance: string
  name: string
  plugin: string
  stage: string
  action: string
  effects: number
  findings?: Array<{ rule: string; category?: string; count: number }> | null
  duration_ms: number
  error?: string
}

export type RequestPluginDryRunResult = {
  rejected: { code: string; message: string; instance: string } | null
  failed: { instance: string; error: string } | null
  steps: RequestPluginDryRunStep[] | null
  body: unknown
  headers?: { set?: Record<string, string> | null; remove?: string[] | null }
  reasoning_effort?: string
  /** The effort the request had before any plugin ran; empty when none. */
  reasoning_effort_before?: string
  /** The reply checks' result, when the run had a reply; `text` is masked. */
  reply?: {
    text: string
    stopped: { instance: string; code: string; message: string } | null
  } | null
  /** What the log owner would see about this request in their logs. */
  record?: RequestPluginRecordItem[] | null
}

export type TaskPluginRecord = {
  id: number
  key: string
  api_version: number
  version: string
  source: string
  source_hash: string
  enabled: boolean
  active: boolean
  created_at: number
  remark: string
}

/**
 * The parts a plugin version has. Older servers send none of these: a missing
 * `task` counts as a task part, a missing credential hook or request
 * processing part as absent.
 */
export type TaskPluginParts = {
  task?: boolean
  provider?: boolean
  login?: boolean
  refresh?: boolean
  /** The plugin exports request processing stage hooks. */
  transform?: boolean
}

export type TaskPluginListItem = TaskPluginParts & {
  meta: TaskPluginMeta
  source: 'factory' | 'override' | 'override_over_factory'
  enabled: boolean
  active: boolean
  source_hash: string
  has_icon?: boolean
  remark: string
  runtime_status:
    | 'registered'
    | 'compile_failed'
    | 'disabled'
    | 'disabled_fallback'
    | 'not_registered'
  runtime_error?: string
  factory_meta?: TaskPluginMeta
  channel_count: number
  in_flight_count: number
  /** Declared routes the gateway serves only under /{key}, as "METHOD /path". */
  skipped_routes?: string[]
  /** The request processing stage hooks, in request order. */
  transform_hooks?: string[] | null
}

export type TaskPluginUsage = {
  channels: Array<{ id: number; name: string }>
  in_flight_count: number
}

export type TaskPluginDetail = TaskPluginParts & {
  plugin?: TaskPluginRecord
  meta: TaskPluginMeta
  source: string
  layer: 'factory' | 'override'
  has_icon?: boolean
  /** Declared routes the gateway serves only under /{key}, as "METHOD /path". */
  skipped_routes?: string[]
  /** Set when the upload put this version into service. */
  pricing_issues?: ModelPricingIssue[]
  /** The request processing stage hooks, in request order. */
  transform_hooks?: string[] | null
}

/**
 * Answer of an activation, a switch-on or the deletion of the active version:
 * the prices the plugin now serving the key cannot charge.
 */
export type TaskPluginPricingNotice = {
  pricing_issues?: ModelPricingIssue[] | null
} | null

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type TaskPluginDryRunRequest = {
  hook: string
  member?: string
  args: unknown[]
}

export type MarketplaceSource = {
  name: string
  index_url: string
}

/**
 * A single installable version from a marketplace index. `allowedHosts`,
 * `baseUrl`, `auth` and `sha256` are optional: older or hand-rolled indexes may
 * omit them, and the confirmation dialog degrades to a warning rather than
 * refusing to render.
 */
export type MarketplaceIndexVersion = {
  version: string
  path: string
  sha256?: string
  minApiVersion?: number
  kind?: string
  allowedHosts?: string[]
  baseUrl?: string
  auth?: string
}

export type MarketplacePluginIcon = {
  /** Index-relative path of the sidecar icon.svg / icon.png, resolved like `path`. */
  path: string
  sha256?: string
}

export type MarketplacePluginAuthor = {
  login: string
  url?: string
}

/** A community plugin file the marketplace took down, named by its digest. */
export type MarketplaceRevokedEntry = {
  sha256: string
  key?: string
  reason?: string | Record<string, string>
}

export type MarketplacePlugin = TaskPluginParts & {
  /** Community fields: the author's GitHub account, repository, plugin code and recent installs. */
  author?: MarketplacePluginAuthor
  repo?: string
  code?: string
  installs30d?: number
  recommended?: boolean
  protocols?: TaskPluginProtocolClaim[]
  sortPriority?: number
  website?: string
  key: string
  name: string
  icon?: string
  /** Sidecar logo published by the index; rendered from the source repository. */
  iconFile?: MarketplacePluginIcon
  description?: string | Record<string, string>
  channelTypes?: number[]
  models?: string[]
  relay?: TaskPluginRelayRoute[]
  latest: string
  versions: MarketplaceIndexVersion[]
}

export type MarketplaceIndex = {
  indexVersion: number
  name: string
  plugins: MarketplacePlugin[]
  revoked?: MarketplaceRevokedEntry[]
}

/** A missing source property is distinct from an empty value or an unreadable expression. */
export type PluginPreviewField<T> =
  | { state: 'value'; value: T; origin: 'source' | 'index' }
  | { state: 'missing'; origin: 'source' }
  | { state: 'unknown' }

export type PluginPreviewValues = {
  key: string
  models: string[]
  protocols: TaskPluginProtocolClaim[]
  routes: TaskPluginRoute[]
  channelTypes: number[]
  baseUrl: string
  allowedHosts: string[]
  auth: string
}

export type PluginMetaPreview = {
  status: 'parsed' | 'partial' | 'unavailable'
  fields: {
    [Key in keyof PluginPreviewValues]: PluginPreviewField<
      PluginPreviewValues[Key]
    >
  }
}
