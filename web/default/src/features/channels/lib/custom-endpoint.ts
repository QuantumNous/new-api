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

export const CUSTOM_ENDPOINT_CHANNEL_TYPE = 58

export type CustomEndpointTransformer =
  | 'openai_chat_completions'
  | 'openai_completions'
  | 'openai_responses'
  | 'openai_responses_compact'
  | 'openai_embeddings'
  | 'openai_images'
  | 'openai_audio'
  | 'openai_moderations'
  | 'claude_messages'
  | 'gemini_generate_content'
  | 'gemini_embeddings'
  | 'gemini_image'
  | 'jina_rerank'
  | 'cohere_rerank'

export type CustomEndpointRoute = {
  path: string
  transformer: CustomEndpointTransformer
  stream_options_supported?: boolean
}

export type CustomEndpointRoutes = Record<string, CustomEndpointRoute>

export type CustomEndpointRouteDraft = {
  id: string
  entryPath: string
  path: string
  transformer: CustomEndpointTransformer
  streamOptionsSupported: boolean
}

type CustomEndpointTransformerOption = {
  value: CustomEndpointTransformer
  label: string
}

type CustomEndpointRoutesTextState = {
  routes: CustomEndpointRoutes | null
  drafts: CustomEndpointRouteDraft[]
  parseError: string | null
  validationError: string | null
}

export const CUSTOM_ENDPOINT_TRANSFORMER_OPTIONS: CustomEndpointTransformerOption[] =
  [
    { value: 'openai_chat_completions', label: 'OpenAI Chat Completions' },
    { value: 'openai_completions', label: 'OpenAI Completions' },
    { value: 'openai_responses', label: 'OpenAI Responses' },
    { value: 'openai_responses_compact', label: 'OpenAI Responses Compact' },
    { value: 'openai_embeddings', label: 'OpenAI Embeddings' },
    { value: 'openai_images', label: 'OpenAI Images' },
    { value: 'openai_audio', label: 'OpenAI Audio' },
    { value: 'openai_moderations', label: 'OpenAI Moderations' },
    { value: 'claude_messages', label: 'Claude Messages' },
    { value: 'gemini_generate_content', label: 'Gemini Generate Content' },
    { value: 'gemini_embeddings', label: 'Gemini Embeddings' },
    { value: 'gemini_image', label: 'Gemini Image' },
    { value: 'jina_rerank', label: 'Jina Rerank' },
    { value: 'cohere_rerank', label: 'Cohere Rerank' },
  ]

const ALL_TRANSFORMER_VALUES = CUSTOM_ENDPOINT_TRANSFORMER_OPTIONS.map(
  (option) => option.value
)

const CUSTOM_ENDPOINT_TRANSFORMER_SET = new Set<CustomEndpointTransformer>(
  ALL_TRANSFORMER_VALUES
)

const transformerOptionMap = new Map<
  CustomEndpointTransformer,
  CustomEndpointTransformerOption
>(CUSTOM_ENDPOINT_TRANSFORMER_OPTIONS.map((option) => [option.value, option]))

const OPENAI_CHAT_COMPATIBLE_TRANSFORMERS: CustomEndpointTransformer[] = [
  'openai_chat_completions',
  'claude_messages',
  'gemini_generate_content',
  'openai_responses',
]

const CLAUDE_MESSAGE_TRANSFORMERS: CustomEndpointTransformer[] = [
  'claude_messages',
  'openai_chat_completions',
  'gemini_generate_content',
]

const GEMINI_GENERATE_CONTENT_TRANSFORMERS: CustomEndpointTransformer[] = [
  'gemini_generate_content',
  'openai_chat_completions',
]

export const CUSTOM_ENDPOINT_ROUTE_PRESETS = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/responses',
  '/v1/responses/compact',
  '/v1/messages',
  '/v1/embeddings',
  '/v1/images/generations',
  '/v1/images/edits',
  '/v1/audio/speech',
  '/v1/audio/transcriptions',
  '/v1/audio/translations',
  '/v1/moderations',
  '/v1/rerank',
  '/rerank',
  '/v1beta/models/{model}:generateContent',
  '/v1beta/models/{model}:streamGenerateContent',
  '/v1beta/models/{model}:embedContent',
  '/v1beta/models/{model}:batchEmbedContents',
  '/v1/models/{model}:generateContent',
  '/v1/models/{model}:streamGenerateContent',
  '/v1/models/{model}:embedContent',
  '/v1/models/{model}:batchEmbedContents',
]

export const CUSTOM_ENDPOINT_ROUTE_PRESET_OPTIONS =
  CUSTOM_ENDPOINT_ROUTE_PRESETS.map((preset) => ({
    value: preset,
    label: preset,
  }))

const SUPPORTED_CUSTOM_ENDPOINT_ROUTE_PATHS = new Set(
  CUSTOM_ENDPOINT_ROUTE_PRESETS
)

const GEMINI_CUSTOM_ENDPOINT_ROUTE_PREFIXES = [
  '/v1beta/models/',
  '/v1/models/',
] as const

const GEMINI_GENERATE_CONTENT_SUFFIXES = [
  ':generateContent',
  ':streamGenerateContent',
] as const

const GEMINI_EMBEDDING_SUFFIXES = [
  ':embedContent',
  ':batchEmbedContents',
] as const

const ROUTE_TRANSFORMER_VALUES: Record<
  string,
  readonly CustomEndpointTransformer[]
> = {
  '/v1/chat/completions': OPENAI_CHAT_COMPATIBLE_TRANSFORMERS,
  '/v1/messages': CLAUDE_MESSAGE_TRANSFORMERS,
  '/v1/completions': ['openai_completions'],
  '/v1/responses': ['openai_responses'],
  '/v1/responses/compact': ['openai_responses_compact'],
  '/v1/embeddings': ['openai_embeddings', 'gemini_embeddings'],
  '/v1/images/generations': ['openai_images', 'gemini_image'],
  '/v1/images/edits': ['openai_images'],
  '/v1/audio/speech': ['openai_audio'],
  '/v1/audio/transcriptions': ['openai_audio'],
  '/v1/audio/translations': ['openai_audio'],
  '/v1/moderations': ['openai_moderations'],
  '/v1/rerank': ['jina_rerank', 'cohere_rerank'],
  '/rerank': ['jina_rerank', 'cohere_rerank'],
}

export const CUSTOM_ENDPOINT_ROUTE_TEMPLATES: Array<{
  id: string
  label: string
  routes: CustomEndpointRoutes
}> = [
  {
    id: 'claude_to_openai',
    label: 'Claude to OpenAI',
    routes: {
      '/v1/messages': {
        path: 'https://api.openai.com/v1/chat/completions',
        transformer: 'openai_chat_completions',
      },
    },
  },
  {
    id: 'openai_family',
    label: 'OpenAI Family',
    routes: {
      '/v1/chat/completions': {
        path: 'https://api.openai.com/v1/chat/completions',
        transformer: 'openai_chat_completions',
      },
      '/v1/responses': {
        path: 'https://api.openai.com/v1/responses',
        transformer: 'openai_responses',
      },
      '/v1/embeddings': {
        path: 'https://api.openai.com/v1/embeddings',
        transformer: 'openai_embeddings',
      },
    },
  },
  {
    id: 'gemini_direct',
    label: 'Gemini Direct',
    routes: {
      '/v1beta/models/{model}:generateContent': {
        path: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        transformer: 'gemini_generate_content',
      },
      '/v1beta/models/{model}:embedContent': {
        path: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent',
        transformer: 'gemini_embeddings',
      },
    },
  },
]

const customEndpointRouteTemplateMap = new Map(
  CUSTOM_ENDPOINT_ROUTE_TEMPLATES.map((template) => [template.id, template])
)

export const CUSTOM_ENDPOINT_ROUTES_PLACEHOLDER = formatCustomEndpointRoutes(
  CUSTOM_ENDPOINT_ROUTE_TEMPLATES[0].routes
)

export function formatCustomEndpointRoutes(
  routes: CustomEndpointRoutes
): string {
  return JSON.stringify(routes, null, 2)
}

export function parseCustomEndpointRoutesText(value: string): {
  routes: CustomEndpointRoutes | null
  error: string | null
} {
  if (!value.trim()) {
    return { routes: null, error: null }
  }
  try {
    const parsed = JSON.parse(value)
    if (!isPlainObject(parsed)) {
      return { routes: null, error: 'Routes must be a JSON object' }
    }
    return { routes: parsed as CustomEndpointRoutes, error: null }
  } catch {
    return { routes: null, error: 'Invalid JSON format' }
  }
}

export function getCustomEndpointRoutesTextState(
  value: string,
  required: boolean
): CustomEndpointRoutesTextState {
  const { routes, error } = parseCustomEndpointRoutesText(value)
  const validationError =
    error || validateCustomEndpointRoutes(routes, required)

  return {
    routes,
    drafts: routes ? customEndpointRoutesToDrafts(routes) : [],
    parseError: error,
    validationError,
  }
}

export function validateCustomEndpointRoutesText(
  value: string,
  required: boolean
): string | null {
  const { routes, error } = parseCustomEndpointRoutesText(value)
  if (error) return error
  return validateCustomEndpointRoutes(routes, required)
}

export function customEndpointRoutesToDrafts(
  routes: CustomEndpointRoutes
): CustomEndpointRouteDraft[] {
  const drafts: CustomEndpointRouteDraft[] = []
  let index = 0

  for (const [entryPath, route] of Object.entries(routes)) {
    drafts.push({
      id: createCustomEndpointRouteDraftId(index),
      entryPath,
      ...normalizeCustomEndpointRouteDraft(entryPath, route),
    })
    index += 1
  }

  return drafts
}

export function createEmptyCustomEndpointRouteDraft(
  drafts: CustomEndpointRouteDraft[]
): CustomEndpointRouteDraft {
  const usedEntryPaths = new Set<string>()
  for (const draft of drafts) {
    const entryPath = draft.entryPath.trim()
    if (entryPath) usedEntryPaths.add(entryPath)
  }

  let entryPath = ''
  for (const preset of CUSTOM_ENDPOINT_ROUTE_PRESETS) {
    if (!usedEntryPaths.has(preset)) {
      entryPath = preset
      break
    }
  }

  return {
    id: createNextCustomEndpointRouteDraftId(drafts),
    entryPath,
    path: '',
    transformer: getDefaultCustomEndpointTransformer(entryPath),
    streamOptionsSupported: true,
  }
}

export function customEndpointRouteDraftsToRoutes(
  drafts: CustomEndpointRouteDraft[]
): CustomEndpointRoutes {
  const routes: CustomEndpointRoutes = {}

  for (const draft of drafts) {
    const route: CustomEndpointRoute = {
      path: draft.path.trim(),
      transformer: draft.transformer,
    }
    if (!draft.streamOptionsSupported) {
      route.stream_options_supported = false
    }
    routes[draft.entryPath.trim()] = route
  }

  return routes
}

export function customEndpointRouteDraftsToJson(
  drafts: CustomEndpointRouteDraft[]
): string {
  if (drafts.length === 0) return ''
  return formatCustomEndpointRoutes(customEndpointRouteDraftsToRoutes(drafts))
}

export function duplicateCustomEndpointEntryPaths(
  drafts: CustomEndpointRouteDraft[]
): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const draft of drafts) {
    const entryPath = draft.entryPath.trim()
    if (!entryPath) continue
    if (seen.has(entryPath)) {
      duplicates.add(entryPath)
      continue
    }
    seen.add(entryPath)
  }

  return [...duplicates]
}

export function getCustomEndpointRouteTemplate(templateId: string) {
  return customEndpointRouteTemplateMap.get(templateId) ?? null
}

export function ensureCustomEndpointRouteDraftTransformer(
  entryPath: string,
  transformer: CustomEndpointTransformer
): CustomEndpointTransformer {
  return isCustomEndpointTransformerAllowed(entryPath, transformer)
    ? transformer
    : getDefaultCustomEndpointTransformer(entryPath)
}

export function getAllowedCustomEndpointTransformers(
  entryPath: string
): CustomEndpointTransformerOption[] {
  return getAllowedTransformerValues(entryPath).map(
    (value) => transformerOptionMap.get(value)!
  )
}

export function getDefaultCustomEndpointTransformer(
  entryPath: string
): CustomEndpointTransformer {
  return getAllowedTransformerValues(entryPath)[0] ?? 'openai_chat_completions'
}

export function isSupportedCustomEndpointRoutePath(entryPath: string): boolean {
  return (
    SUPPORTED_CUSTOM_ENDPOINT_ROUTE_PATHS.has(entryPath) ||
    getGeminiCustomEndpointRouteKind(entryPath) !== null
  )
}

function validateCustomEndpointRoutes(
  routes: CustomEndpointRoutes | null,
  required: boolean
): string | null {
  if (!routes) {
    return required ? 'At least one custom endpoint route is required' : null
  }

  let routeCount = 0
  for (const [entryPath, routeValue] of Object.entries(routes)) {
    routeCount += 1
    const entryPathError = validateCustomEndpointEntryPath(entryPath)
    if (entryPathError) return entryPathError

    if (!isPlainObject(routeValue)) {
      return `Route ${entryPath} must be a JSON object`
    }

    const route = routeValue as Record<string, unknown>
    const finalPath = route.path
    if (typeof finalPath !== 'string' || !finalPath.trim()) {
      return `Route ${entryPath} requires a final request URL`
    }
    if (finalPath !== finalPath.trim()) {
      return `Route ${entryPath} URL must not include surrounding whitespace`
    }
    try {
      const parsedUrl = new URL(finalPath)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return `Route ${entryPath} URL must start with http:// or https://`
      }
      if (!parsedUrl.host.trim()) {
        return `Route ${entryPath} URL must include host`
      }
    } catch {
      return `Route ${entryPath} URL is invalid`
    }

    const transformer = route.transformer
    if (!transformer) {
      return `Route ${entryPath} requires a transformer`
    }
    if (!isValidCustomEndpointTransformer(transformer)) {
      return `Route ${entryPath} transformer is invalid: ${String(transformer)}`
    }
    if (
      route.stream_options_supported !== undefined &&
      typeof route.stream_options_supported !== 'boolean'
    ) {
      return `Route ${entryPath} stream_options_supported must be boolean`
    }
  }

  if (routeCount === 0) {
    return required ? 'At least one custom endpoint route is required' : null
  }

  return null
}

function getAllowedTransformerValues(
  entryPath: string
): readonly CustomEndpointTransformer[] {
  const explicitValues = ROUTE_TRANSFORMER_VALUES[entryPath]
  if (explicitValues) return explicitValues

  const geminiKind = getGeminiCustomEndpointRouteKind(entryPath)
  if (geminiKind === 'embedding') {
    return ['gemini_embeddings']
  }
  if (geminiKind === 'generate_content') {
    return GEMINI_GENERATE_CONTENT_TRANSFORMERS
  }

  return ALL_TRANSFORMER_VALUES
}

function getGeminiCustomEndpointRouteKind(
  entryPath: string
): 'generate_content' | 'embedding' | null {
  let modelAndAction = ''
  for (const prefix of GEMINI_CUSTOM_ENDPOINT_ROUTE_PREFIXES) {
    if (entryPath.startsWith(prefix)) {
      modelAndAction = entryPath.slice(prefix.length)
      break
    }
  }
  if (!modelAndAction) return null

  for (const suffix of GEMINI_GENERATE_CONTENT_SUFFIXES) {
    if (modelAndAction.endsWith(suffix)) {
      return modelAndAction.slice(0, -suffix.length).trim()
        ? 'generate_content'
        : null
    }
  }
  for (const suffix of GEMINI_EMBEDDING_SUFFIXES) {
    if (modelAndAction.endsWith(suffix)) {
      return modelAndAction.slice(0, -suffix.length).trim() ? 'embedding' : null
    }
  }
  return null
}

function validateCustomEndpointEntryPath(entryPath: string): string | null {
  if (!entryPath) return 'Route entry path is required'
  if (entryPath !== entryPath.trim()) {
    return `Route entry path ${entryPath} must not include surrounding whitespace`
  }
  if (entryPath.includes('://')) {
    return `Route entry path ${entryPath} must not be a full URL`
  }
  if (!entryPath.startsWith('/')) {
    return `Route entry path ${entryPath} must start with /`
  }
  if (entryPath.includes('?')) {
    return `Route entry path ${entryPath} must not include query`
  }
  if (!isSupportedCustomEndpointRoutePath(entryPath)) {
    return `Route entry path is unsupported: ${entryPath}`
  }
  return null
}

function normalizeCustomEndpointRouteDraft(
  entryPath: string,
  value: unknown
): Omit<CustomEndpointRouteDraft, 'id' | 'entryPath'> {
  if (!isPlainObject(value)) {
    return {
      path: '',
      transformer: getDefaultCustomEndpointTransformer(entryPath),
      streamOptionsSupported: true,
    }
  }

  const path = typeof value.path === 'string' ? value.path : ''
  const transformer = isValidCustomEndpointTransformer(value.transformer)
    ? ensureCustomEndpointRouteDraftTransformer(entryPath, value.transformer)
    : getDefaultCustomEndpointTransformer(entryPath)

  return {
    path,
    transformer,
    streamOptionsSupported: value.stream_options_supported !== false,
  }
}

function isValidCustomEndpointTransformer(
  value: unknown
): value is CustomEndpointTransformer {
  return (
    typeof value === 'string' &&
    CUSTOM_ENDPOINT_TRANSFORMER_SET.has(value as CustomEndpointTransformer)
  )
}

function isCustomEndpointTransformerAllowed(
  entryPath: string,
  transformer: CustomEndpointTransformer
): boolean {
  return getAllowedTransformerValues(entryPath).includes(transformer)
}

function createCustomEndpointRouteDraftId(index: number): string {
  return `custom-endpoint-route-${index}`
}

function createNextCustomEndpointRouteDraftId(
  drafts: CustomEndpointRouteDraft[]
): string {
  let nextIndex = 0
  for (const draft of drafts) {
    const currentIndex = Number(draft.id.replace('custom-endpoint-route-', ''))
    if (Number.isInteger(currentIndex) && currentIndex >= nextIndex) {
      nextIndex = currentIndex + 1
    }
  }
  return createCustomEndpointRouteDraftId(nextIndex)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
