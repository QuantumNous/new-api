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
  AdvancedCustomAuthType,
  AdvancedCustomConfig,
  AdvancedCustomConverter,
  AdvancedCustomRoute,
  AdvancedCustomRouteAuth,
} from '../types'

export const CHANNEL_TYPE_ADVANCED_CUSTOM = 58

export const ADVANCED_CUSTOM_CONVERTER_OPTIONS: Array<{
  value: AdvancedCustomConverter
  label: string
}> = [
  { value: 'none', label: 'Native forwarding' },
  {
    value: 'anthropic_messages_to_openai_chat_completions',
    label: 'Anthropic Messages to OpenAI Chat',
  },
  {
    value: 'openai_chat_completions_to_anthropic_messages',
    label: 'OpenAI Chat to Anthropic Messages',
  },
  {
    value: 'openai_chat_completions_to_openai_responses',
    label: 'OpenAI Chat to OpenAI Responses',
  },
  {
    value: 'openai_responses_to_openai_chat_completions',
    label: 'OpenAI Responses to OpenAI Chat',
  },
  {
    value: 'gemini_generate_content_to_openai_chat_completions',
    label: 'Gemini Generate Content to OpenAI Chat',
  },
  {
    value: 'openai_chat_completions_to_gemini_generate_content',
    label: 'OpenAI Chat to Gemini Generate Content',
  },
]

export type AdvancedCustomAuthMode = 'default' | AdvancedCustomAuthType

export const ADVANCED_CUSTOM_AUTH_MODE_OPTIONS: Array<{
  value: AdvancedCustomAuthMode
  label: string
}> = [
  { value: 'default', label: 'Default Bearer' },
  { value: 'none', label: 'No Auth' },
  { value: 'header', label: 'Header' },
  { value: 'query', label: 'Query' },
]

export type AdvancedCustomIncomingPathOption = {
  value: string
  label: string
}

export const ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS: AdvancedCustomIncomingPathOption[] =
  [
    {
      value: '/v1/chat/completions',
      label: 'OpenAI Chat Completions',
    },
    {
      value: '/v1/completions',
      label: 'OpenAI Completions',
    },
    {
      value: '/v1/responses',
      label: 'OpenAI Responses',
    },
    {
      value: '/v1/responses/compact',
      label: 'OpenAI Responses Compact',
    },
    {
      value: '/v1/embeddings',
      label: 'OpenAI Embeddings',
    },
    {
      value: '/v1/images/generations',
      label: 'OpenAI Image Generations',
    },
    {
      value: '/v1/images/edits',
      label: 'OpenAI Image Edits',
    },
    {
      value: '/v1/audio/speech',
      label: 'OpenAI Audio Speech',
    },
    {
      value: '/v1/audio/transcriptions',
      label: 'OpenAI Audio Transcriptions',
    },
    {
      value: '/v1/audio/translations',
      label: 'OpenAI Audio Translations',
    },
    {
      value: '/v1/rerank',
      label: 'OpenAI Rerank',
    },
    {
      value: '/v1/realtime',
      label: 'OpenAI Realtime',
    },
    {
      value: '/v1/messages',
      label: 'Claude Messages',
    },
    {
      value: '/v1beta/models/{model}:generateContent',
      label: 'Gemini Generate Content',
    },
    {
      value: '/v1beta/models/{model}:embedContent',
      label: 'Gemini Embed Content',
    },
    {
      value: '/v1beta/models/{model}:batchEmbedContents',
      label: 'Gemini Batch Embed Contents',
    },
  ]

export type AdvancedCustomValidationError = {
  message: string
  routeIndex?: number
}

export type AdvancedCustomTemplateOption = {
  value: string
  label: string
  config: AdvancedCustomConfig
}

const bearerHeaderAuth = (): AdvancedCustomRouteAuth => ({
  type: 'header',
  name: 'Authorization',
  value: 'Bearer {api_key}',
})

const apiKeyHeaderAuth = (): AdvancedCustomRouteAuth => ({
  type: 'header',
  name: 'x-api-key',
  value: '{api_key}',
})

const geminiQueryAuth = (): AdvancedCustomRouteAuth => ({
  type: 'query',
  name: 'key',
  value: '{api_key}',
})

export const ADVANCED_CUSTOM_TEMPLATE_OPTIONS: AdvancedCustomTemplateOption[] =
  [
    {
      value: 'official_openai_chat',
      label: 'Official OpenAI Chat',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/chat/completions',
            upstream_path: '/v1/chat/completions',
            converter: 'none',
            auth: bearerHeaderAuth(),
          },
        ],
      },
    },
    {
      value: 'official_openai_responses',
      label: 'Official OpenAI Responses',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/responses',
            upstream_path: '/v1/responses',
            converter: 'none',
            auth: bearerHeaderAuth(),
          },
        ],
      },
    },
    {
      value: 'official_openai_embeddings',
      label: 'Official OpenAI Embeddings',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/embeddings',
            upstream_path: '/v1/embeddings',
            converter: 'none',
            auth: bearerHeaderAuth(),
          },
        ],
      },
    },
    {
      value: 'official_openai_images',
      label: 'Official OpenAI Images',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/images/generations',
            upstream_path: '/v1/images/generations',
            converter: 'none',
            auth: bearerHeaderAuth(),
          },
          {
            incoming_path: '/v1/images/edits',
            upstream_path: '/v1/images/edits',
            converter: 'none',
            auth: bearerHeaderAuth(),
          },
        ],
      },
    },
    {
      value: 'official_claude_messages',
      label: 'Official Claude Messages',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/messages',
            upstream_path: '/v1/messages',
            converter: 'none',
            auth: apiKeyHeaderAuth(),
          },
        ],
      },
    },
    {
      value: 'official_gemini_native',
      label: 'Official Gemini Native',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1beta/models/{model}:generateContent',
            upstream_path: '/v1beta/models/{model}:generateContent',
            converter: 'none',
            auth: geminiQueryAuth(),
          },
          {
            incoming_path: '/v1beta/models/{model}:embedContent',
            upstream_path: '/v1beta/models/{model}:embedContent',
            converter: 'none',
            auth: geminiQueryAuth(),
          },
          {
            incoming_path: '/v1beta/models/{model}:batchEmbedContents',
            upstream_path: '/v1beta/models/{model}:batchEmbedContents',
            converter: 'none',
            auth: geminiQueryAuth(),
          },
        ],
      },
    },
    {
      value: 'official_gemini_from_openai_chat',
      label: 'Official Gemini from OpenAI Chat',
      config: {
        advanced_routes: [
          {
            incoming_path: '/v1/chat/completions',
            upstream_path: '/v1beta/models/{model}:generateContent',
            converter: 'openai_chat_completions_to_gemini_generate_content',
            auth: geminiQueryAuth(),
          },
        ],
      },
    },
  ]

export function cloneAdvancedCustomConfig(
  config: AdvancedCustomConfig
): AdvancedCustomConfig {
  return JSON.parse(JSON.stringify(config)) as AdvancedCustomConfig
}

export function getAdvancedCustomTemplateConfig(
  templateKey: string
): AdvancedCustomConfig {
  const template =
    ADVANCED_CUSTOM_TEMPLATE_OPTIONS.find(
      (option) => option.value === templateKey
    ) || ADVANCED_CUSTOM_TEMPLATE_OPTIONS[0]
  return cloneAdvancedCustomConfig(template.config)
}

export function createAdvancedCustomRoute(): AdvancedCustomRoute {
  return {
    incoming_path: '/v1/chat/completions',
    upstream_path: '/v1/chat/completions',
    converter: 'none',
  }
}

export function createAdvancedCustomConfig(): AdvancedCustomConfig {
  return {
    advanced_routes: [createAdvancedCustomRoute()],
  }
}

export function getAdvancedCustomUpstreamPathPlaceholder(
  converter: AdvancedCustomConverter
): string {
  if (converter === 'openai_chat_completions_to_gemini_generate_content') {
    return '/v1beta/models/{model}:generateContent'
  }
  if (converter === 'openai_chat_completions_to_anthropic_messages') {
    return '/v1/messages'
  }
  if (converter === 'openai_responses_to_openai_chat_completions') {
    return '/v1/chat/completions'
  }
  return '/v1/chat/completions'
}

export function getAdvancedCustomIncomingPathOptions(
  converter: AdvancedCustomConverter
): AdvancedCustomIncomingPathOption[] {
  return ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS.filter((option) =>
    isConverterPathAllowed(option.value, converter)
  )
}

export function getDefaultAdvancedCustomIncomingPath(
  converter: AdvancedCustomConverter
): string {
  return (
    getAdvancedCustomIncomingPathOptions(converter)[0]?.value ||
    '/v1/chat/completions'
  )
}

export function isAdvancedCustomIncomingPathAllowed(
  incomingPath: string,
  converter: AdvancedCustomConverter
): boolean {
  return getAdvancedCustomIncomingPathOptions(converter).some(
    (option) => option.value === incomingPath
  )
}

export function getAdvancedCustomIncomingPathLabel(value: string): string {
  return (
    ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS.find(
      (option) => option.value === value
    )?.label || value
  )
}

export function parseAdvancedCustomConfig(
  value: string | undefined
): AdvancedCustomConfig | null {
  if (!value?.trim()) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return normalizeAdvancedCustomConfig(parsed as AdvancedCustomConfig)
  } catch {
    return null
  }
}

export function stringifyAdvancedCustomConfig(
  config: AdvancedCustomConfig
): string {
  return JSON.stringify(normalizeAdvancedCustomConfig(config), null, 2)
}

export function normalizeAdvancedCustomConfig(
  config: AdvancedCustomConfig
): AdvancedCustomConfig {
  const routes = Array.isArray(config.advanced_routes)
    ? config.advanced_routes.map(normalizeAdvancedCustomRoute)
    : []

  return {
    advanced_routes: routes,
  }
}

export function validateAdvancedCustomConfig(
  config: AdvancedCustomConfig | null
): AdvancedCustomValidationError | null {
  if (!config) {
    return { message: 'Advanced custom configuration is required' }
  }

  const normalized = normalizeAdvancedCustomConfig(config)
  const routes = normalized.advanced_routes || []
  if (routes.length === 0) {
    return {
      message: 'Advanced custom configuration requires at least one route',
    }
  }

  const seenPaths = new Set<string>()
  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index]
    const incomingPath = route.incoming_path?.trim() || ''
    const upstreamPath = getAdvancedCustomRouteUpstreamPath(route)
    const converter = route.converter || 'none'

    if (!incomingPath) {
      return { routeIndex: index, message: 'Incoming path is required' }
    }
    if (!incomingPath.startsWith('/')) {
      return { routeIndex: index, message: 'Incoming path must start with /' }
    }
    if (incomingPath.includes('?')) {
      return {
        routeIndex: index,
        message: 'Incoming path must not include query',
      }
    }
    if (seenPaths.has(incomingPath)) {
      return { routeIndex: index, message: 'Incoming path must be unique' }
    }
    seenPaths.add(incomingPath)

    if (!upstreamPath) {
      return { routeIndex: index, message: 'Upstream path is required' }
    }
    if (!isFullHttpURLOrAbsolutePath(upstreamPath)) {
      return {
        routeIndex: index,
        message: 'Upstream path must be a full URL or a path starting with /',
      }
    }
    if (!isAdvancedCustomConverter(converter)) {
      return { routeIndex: index, message: 'Converter is not registered' }
    }
    if (!isConverterPathAllowed(incomingPath, converter)) {
      return {
        routeIndex: index,
        message: 'Converter does not match incoming path',
      }
    }

    const authError = validateRouteAuth(route.auth)
    if (authError) {
      return { routeIndex: index, message: authError }
    }
  }

  return null
}

export function advancedCustomConfigUsesRelativeUpstreamPath(
  config: AdvancedCustomConfig | null
): boolean {
  if (!config) return false
  const normalized = normalizeAdvancedCustomConfig(config)
  return (normalized.advanced_routes || []).some((route) =>
    getAdvancedCustomRouteUpstreamPath(route).startsWith('/')
  )
}

export function getAdvancedCustomStats(value: string | undefined): {
  routeCount: number
  valid: boolean
} {
  const config = parseAdvancedCustomConfig(value)
  if (!config) {
    return { routeCount: 0, valid: false }
  }
  const normalized = normalizeAdvancedCustomConfig(config)
  return {
    routeCount: normalized.advanced_routes?.length || 0,
    valid: validateAdvancedCustomConfig(normalized) === null,
  }
}

export function getAdvancedCustomAuthMode(
  route: AdvancedCustomRoute
): AdvancedCustomAuthMode {
  return route.auth?.type || 'default'
}

export function buildAdvancedCustomAuth(
  mode: AdvancedCustomAuthMode,
  previousAuth: AdvancedCustomRouteAuth | undefined
): AdvancedCustomRouteAuth | undefined {
  if (mode === 'default') return undefined
  if (mode === 'none') return { type: 'none' }
  if (mode === 'header') {
    return {
      type: 'header',
      name: previousAuth?.name || 'Authorization',
      value: previousAuth?.value || 'Bearer {api_key}',
    }
  }
  return {
    type: 'query',
    name: previousAuth?.name || 'api_key',
    value: previousAuth?.value || '{api_key}',
  }
}

function normalizeAdvancedCustomRoute(
  route: AdvancedCustomRoute
): AdvancedCustomRoute {
  const nextRoute: AdvancedCustomRoute = {
    incoming_path: route.incoming_path || '',
    upstream_path: getAdvancedCustomRouteUpstreamPath(route),
    converter: route.converter || 'none',
  }
  if (route.auth) {
    nextRoute.auth = {
      type: route.auth.type,
      name: route.auth.name || '',
      value: route.auth.value || '',
    }
  }
  return nextRoute
}

function getAdvancedCustomRouteUpstreamPath(route: AdvancedCustomRoute): string {
  return (route.upstream_path || '').trim()
}

function isFullHttpURLOrAbsolutePath(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//')

  try {
    const parsed = new URL(value)
    return (
      Boolean(parsed.host) &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    )
  } catch {
    return false
  }
}

function isAdvancedCustomConverter(
  value: string
): value is AdvancedCustomConverter {
  return ADVANCED_CUSTOM_CONVERTER_OPTIONS.some(
    (option) => option.value === value
  )
}

function isConverterPathAllowed(
  incomingPath: string,
  converter: AdvancedCustomConverter
): boolean {
  if (converter === 'none') return true
  if (converter === 'anthropic_messages_to_openai_chat_completions') {
    return incomingPath === '/v1/messages'
  }
  if (
    converter === 'openai_chat_completions_to_anthropic_messages' ||
    converter === 'openai_chat_completions_to_openai_responses' ||
    converter === 'openai_chat_completions_to_gemini_generate_content'
  ) {
    return incomingPath === '/v1/chat/completions'
  }
  if (converter === 'openai_responses_to_openai_chat_completions') {
    return incomingPath === '/v1/responses'
  }
  return (
    incomingPath.includes(':generateContent') ||
    incomingPath.includes(':streamGenerateContent')
  )
}

function validateRouteAuth(
  auth: AdvancedCustomRouteAuth | undefined
): string | null {
  if (!auth) return null
  if (auth.type === 'none') return null
  if (auth.type !== 'header' && auth.type !== 'query') {
    return 'Auth type is invalid'
  }
  if (!auth.name?.trim()) {
    return 'Auth name is required'
  }
  if (!auth.value?.trim()) {
    return 'Auth value is required'
  }
  return null
}
