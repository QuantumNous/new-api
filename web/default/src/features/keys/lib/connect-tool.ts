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
import type { PricingModel } from '@/features/pricing/types'

export type EndpointTypeId = 'anthropic' | 'openai' | 'gemini' | 'xai'
export type ConnectToolId = 'cc-switch' | 'cherry-studio'

export type EndpointTypeConfig = {
  id: EndpointTypeId
  label: string
  iconKey: string
  vendorMatchers: string[]
  modelMatchers: RegExp[]
  preferPatterns: RegExp[]
  /** Pricing `supported_endpoint_types` values that unlock this provider type. */
  endpointMatchers: string[]
  ccSwitchApp: 'claude' | 'codex' | 'gemini'
}

export const ENDPOINT_TYPES: EndpointTypeConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    iconKey: 'Anthropic',
    vendorMatchers: ['anthropic', 'claude'],
    modelMatchers: [/claude/i],
    preferPatterns: [/sonnet/i, /opus/i, /haiku/i, /claude/i],
    endpointMatchers: ['anthropic'],
    ccSwitchApp: 'claude',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    iconKey: 'OpenAI',
    vendorMatchers: ['openai'],
    modelMatchers: [/^(gpt-|o[1-9]|chatgpt-|codex)/i],
    preferPatterns: [/codex/i, /gpt-4o/i, /gpt-4\.1/i, /gpt/i],
    endpointMatchers: ['openai', 'openai-response', 'openai-response-compact'],
    ccSwitchApp: 'codex',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    iconKey: 'Gemini',
    vendorMatchers: ['gemini', 'google'],
    modelMatchers: [/gemini/i],
    preferPatterns: [/gemini/i],
    endpointMatchers: ['gemini'],
    ccSwitchApp: 'gemini',
  },
  {
    id: 'xai',
    label: 'xAI',
    iconKey: 'XAI',
    vendorMatchers: ['xai', 'x.ai'],
    modelMatchers: [/grok/i],
    preferPatterns: [/grok/i],
    endpointMatchers: [],
    ccSwitchApp: 'codex',
  },
]

export function getEndpointTypeConfig(
  id: EndpointTypeId
): EndpointTypeConfig | undefined {
  return ENDPOINT_TYPES.find((item) => item.id === id)
}

function normalizeVendor(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

export function modelMatchesEndpoint(
  model: PricingModel,
  endpoint: EndpointTypeConfig
): boolean {
  const vendor = normalizeVendor(model.vendor_name)
  if (
    vendor &&
    endpoint.vendorMatchers.some(
      (matcher) => vendor === matcher || vendor.includes(matcher)
    )
  ) {
    return true
  }
  const modelName = model.model_name || ''
  if (endpoint.modelMatchers.some((pattern) => pattern.test(modelName))) {
    return true
  }
  if (endpoint.endpointMatchers.length === 0) return false
  const supported = model.supported_endpoint_types || []
  return supported.some((item) =>
    endpoint.endpointMatchers.includes(String(item).toLowerCase())
  )
}

export function filterModelsForEndpoint(
  models: PricingModel[],
  endpointId: EndpointTypeId
): PricingModel[] {
  const endpoint = getEndpointTypeConfig(endpointId)
  if (!endpoint) return []
  return models.filter((model) => modelMatchesEndpoint(model, endpoint))
}

export function getGroupsForEndpoint(
  models: PricingModel[],
  endpointId: EndpointTypeId,
  usableGroups: string[]
): string[] {
  const usable = new Set(usableGroups)
  const restrictToUsable = usable.size > 0
  const matched = filterModelsForEndpoint(models, endpointId)
  const groups = new Set<string>()
  for (const model of matched) {
    for (const group of model.enable_groups || []) {
      if (!group || group === 'auto') continue
      // Pricing may mark a model as available to every usable group.
      if (group === 'all') {
        if (restrictToUsable) {
          for (const item of usable) {
            if (item && item !== 'auto') groups.add(item)
          }
        }
        continue
      }
      if (!restrictToUsable || usable.has(group)) groups.add(group)
    }
  }
  return [...groups].sort((a, b) => a.localeCompare(b))
}

export function filterModelsForGroup(
  models: PricingModel[],
  endpointId: EndpointTypeId,
  group: string
): PricingModel[] {
  return filterModelsForEndpoint(models, endpointId).filter((model) =>
    (model.enable_groups || []).includes(group)
  )
}

export function recommendModelName(
  models: PricingModel[],
  endpointId: EndpointTypeId
): string {
  const endpoint = getEndpointTypeConfig(endpointId)
  if (!endpoint || models.length === 0) return ''
  for (const pattern of endpoint.preferPatterns) {
    const hit = models.find((model) => pattern.test(model.model_name))
    if (hit) return hit.model_name
  }
  return models[0]?.model_name || ''
}

export function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw) as { server_address?: string }
      if (status.server_address) return status.server_address
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('sk-') ? trimmed : `sk-${trimmed}`
}

export function buildCCSwitchImportURL(params: {
  app: 'claude' | 'codex' | 'gemini'
  name: string
  model: string
  apiKey: string
}): string {
  const serverAddress = getServerAddress()
  const endpoint =
    params.app === 'codex' ? `${serverAddress}/v1` : serverAddress
  const search = new URLSearchParams()
  search.set('resource', 'provider')
  search.set('app', params.app)
  search.set('name', params.name)
  search.set('endpoint', endpoint)
  search.set('apiKey', normalizeApiKey(params.apiKey))
  search.set('model', params.model)
  search.set('homepage', serverAddress)
  search.set('enabled', 'true')
  return `ccswitch://v1/import?${search.toString()}`
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function buildCherryStudioImportURL(apiKey: string): string {
  const serverAddress = getServerAddress()
  const payload = {
    id: 'new-api',
    baseUrl: serverAddress,
    apiKey: normalizeApiKey(apiKey),
  }
  const encoded = encodeURIComponent(toBase64(JSON.stringify(payload)))
  return `cherrystudio://providers/api-keys?v=1&data=${encoded}`
}

export function buildConnectTokenName(
  endpointLabel: string,
  group: string
): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const raw = `${endpointLabel} · ${group} · ${month}-${day}`
  return raw.length > 50 ? raw.slice(0, 50) : raw
}
