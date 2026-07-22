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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserModels } from '@/lib/api'

export interface ProviderEntry {
  /** Stable identifier used as React key */
  id: string
  /** Display label (e.g. "OpenAI", "Claude") */
  label: string
  /** LobeHub icon descriptor (consumed by getLobeIcon) */
  icon: string
  /** Number of matching models surfaced for this provider */
  modelCount: number
}

interface ProviderRule {
  id: string
  label: string
  icon: string
  match: (model: string) => boolean
}

const PROVIDER_RULES: ProviderRule[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: 'OpenAI',
    match: (m) => /^(gpt|o[1-4]|chatgpt|text-|davinci|dall-e|whisper|tts)/i.test(m),
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: 'Claude.Color',
    match: (m) => /^claude/i.test(m),
  },
  {
    id: 'gemini',
    label: 'Gemini',
    icon: 'Gemini.Color',
    match: (m) => /^(gemini|gemma|google)/i.test(m),
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: 'DeepSeek.Color',
    match: (m) => /^deepseek/i.test(m),
  },
  {
    id: 'qwen',
    label: 'Qwen',
    icon: 'Qwen.Color',
    match: (m) => /^(qwen|qwq)/i.test(m),
  },
  {
    id: 'glm',
    label: 'GLM',
    icon: 'ChatGLM.Color',
    match: (m) => /^(glm|chatglm)/i.test(m),
  },
  {
    id: 'meta',
    label: 'Llama',
    icon: 'Meta.Color',
    match: (m) => /^(llama|meta-)/i.test(m),
  },
]

/**
 * Aggregate the user's available model list into a curated set of top providers.
 * Always returns up to 7 known brands followed by an aggregate "More" tile when
 * additional unmapped models exist.
 */
export function useEnabledProviders() {
  const query = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = await getUserModels()
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const providers = useMemo<ProviderEntry[]>(() => {
    const models = query.data ?? []
    const buckets = new Map<string, number>()
    let unmatched = 0

    for (const model of models) {
      let matched = false
      for (const rule of PROVIDER_RULES) {
        if (rule.match(model)) {
          buckets.set(rule.id, (buckets.get(rule.id) ?? 0) + 1)
          matched = true
          break
        }
      }
      if (!matched) unmatched += 1
    }

    let entries: ProviderEntry[] = PROVIDER_RULES.filter((rule) =>
      buckets.has(rule.id)
    ).map((rule) => ({
      id: rule.id,
      label: rule.label,
      icon: rule.icon,
      modelCount: buckets.get(rule.id) ?? 0,
    }))

    // Show known providers even when no model matches (gateway can still route to them).
    if (entries.length === 0) {
      entries = PROVIDER_RULES.slice(0, 7).map((rule) => ({
        id: rule.id,
        label: rule.label,
        icon: rule.icon,
        modelCount: 0,
      }))
    }

    // Always reserve the last slot for "More models" — keeps the grid balanced
    // and gives the user an entry point to the full pricing/models catalog.
    entries = entries.slice(0, 7)
    entries.push({
      id: 'more',
      label: 'More',
      icon: '',
      modelCount: unmatched,
    })

    return entries
  }, [query.data])

  return {
    providers,
    loading: query.isLoading,
    totalModels: query.data?.length ?? 0,
  }
}
