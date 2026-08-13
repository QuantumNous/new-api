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
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { getUserModels } from '@/lib/api'
import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getPricing } from '@/features/pricing/api'
import { useApiInfo } from '../../hooks/use-status-data'
import { IntegrationCards } from './integration-cards'
import { IntegrationDialog } from './integration-dialog'
import {
  API_KEY_PLACEHOLDER,
  type IntegrationId,
  type SnippetContext,
  type SnippetKind,
} from './integration-snippets'
import { OverviewHero } from './overview-hero'
import { UsageMetrics } from './usage-metrics'
import { useResolvedApiKeys } from './use-resolved-api-keys'

const PREFERRED_EXAMPLE_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'gpt-5-mini',
  'gpt-4o',
]

// The example only knows how to demo chat and image generation, so models
// whose only surfaces are embedding/TTS/video would produce a failing request.
// Endpoint tags come from channel config, so this is an exclusion list plus
// a name heuristic (metadata is not always tagged — gemini-embedding-001
// carries only ['gemini','openai']); untagged models stay in as chat.
const EXCLUDED_ENDPOINT_TYPES = ['openai-video', 'embeddings', 'jina-rerank']
const EXCLUDED_NAME_PATTERN = /(^|[-_.])(embedding|tts|video|seedance)/i
const IMAGE_NAME_PATTERN = /(^|[-_.])(image|banana)/i
const CHAT_ENDPOINT_TYPES = [
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
]

const RECENT_KEY_LIMIT = 3

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function pickDefaultModel(models: string[]): string {
  return (
    PREFERRED_EXAMPLE_MODELS.find((model) => models.includes(model)) ??
    models[0] ??
    'gpt-4o-mini'
  )
}

function normalizeEndpoint(sourceUrl?: string): string {
  const fallback = `${getCurrentOrigin()}/v1/chat/completions`
  const trimmed = sourceUrl?.trim()
  if (!trimmed) return fallback

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (withoutTrailingSlash.endsWith('/v1/chat/completions')) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith('/v1')) {
    return `${withoutTrailingSlash}/chat/completions`
  }
  return `${withoutTrailingSlash}/v1/chat/completions`
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? keys[0] ?? null
}

export function OverviewDashboard() {
  const user = useAuthStore((state) => state.auth.user)
  const { items: apiInfoItems } = useApiInfo()
  const [openIntegration, setOpenIntegration] = useState<IntegrationId | null>(
    null
  )
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      // The API returns newest-first, so this is the user's most recent keys.
      const result = await getApiKeys({ p: 1, size: RECENT_KEY_LIMIT })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const apiKeys = useMemo(() => apiKeysQuery.data ?? [], [apiKeysQuery.data])
  const resolvedKeys = useResolvedApiKeys(apiKeys, openIntegration !== null)

  const selectedKey = useMemo(() => {
    const match = apiKeys.find((key) => key.id === selectedKeyId)
    return match ?? getPreferredKey(apiKeys)
  }, [apiKeys, selectedKeyId])

  // Scope the model list to the group the selected key actually routes with,
  // so the example only offers models this key can call.
  const modelGroup = selectedKey?.group?.trim() || user?.group || ''

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models', modelGroup],
    queryFn: async () => {
      const result = await getUserModels(modelGroup || undefined)
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
    enabled: openIntegration !== null,
  })

  // Shares the pricing page's query cache; only used to read endpoint tags.
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
    enabled: openIntegration !== null,
  })

  const modelEndpointTags = useMemo(() => {
    const tags = new Map<string, string[]>()
    for (const row of pricingQuery.data?.data ?? []) {
      tags.set(row.model_name, row.supported_endpoint_types ?? [])
    }
    return tags
  }, [pricingQuery.data])

  const classifyModel = useCallback(
    (model: string): SnippetKind | null => {
      const types = modelEndpointTags.get(model) ?? []
      // The name heuristic wins over tags: metadata dirt routinely marks
      // embedding/TTS models as plain 'openai'.
      if (EXCLUDED_NAME_PATTERN.test(model)) {
        return null
      }
      if (
        types.includes('image-generation') ||
        IMAGE_NAME_PATTERN.test(model)
      ) {
        return 'image'
      }
      // A multi-endpoint model that can also chat stays demoable — only
      // models with exclusively non-demoable surfaces get dropped.
      if (
        types.length === 0 ||
        types.some((type) => CHAT_ENDPOINT_TYPES.includes(type))
      ) {
        return 'chat'
      }
      if (types.some((type) => EXCLUDED_ENDPOINT_TYPES.includes(type))) {
        return null
      }
      return 'chat'
    },
    [modelEndpointTags]
  )

  const availableModels = useMemo(() => {
    const models = modelsQuery.data ?? []
    const filtered = models.filter((model) => classifyModel(model) !== null)
    // Never filter down to an empty dropdown on odd channel metadata.
    return filtered.length > 0 ? filtered : models
  }, [classifyModel, modelsQuery.data])

  const exampleModel = useMemo(() => {
    if (selectedModel && availableModels.includes(selectedModel)) {
      return selectedModel
    }
    return pickDefaultModel(availableModels)
  }, [availableModels, selectedModel])

  const snippetContext = useMemo<SnippetContext>(
    () => ({
      endpoint: normalizeEndpoint(apiInfoItems[0]?.url),
      model: exampleModel,
      kind: classifyModel(exampleModel) ?? 'chat',
      apiKey: selectedKey ? `sk-${selectedKey.key}` : API_KEY_PLACEHOLDER,
    }),
    [apiInfoItems, classifyModel, exampleModel, selectedKey]
  )

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-10'>
      <OverviewHero />
      <UsageMetrics />
      <IntegrationCards onSelect={setOpenIntegration} />
      <IntegrationDialog
        integrationId={openIntegration}
        onOpenChange={(open) => {
          if (!open) setOpenIntegration(null)
        }}
        keys={apiKeys}
        keysLoading={apiKeysQuery.isPending}
        selectedKeyId={selectedKey?.id ?? null}
        resolvedKeys={resolvedKeys}
        onSelectKey={setSelectedKeyId}
        models={availableModels}
        selectedModel={exampleModel}
        onSelectModel={setSelectedModel}
        snippetContext={snippetContext}
      />
    </div>
  )
}
