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
export const QUICK_SETUP_API_KEY_PLACEHOLDER = 'sk-••••••••'
export const OPENCODE_PROVIDER_ID = 'newapi'
export const CLAUDE_CODE_MODEL_PLACEHOLDER = 'your-model'

export type ClaudeCodeSnippetFormat = 'settings' | 'shell'
export type QuickSetupClient = 'claude' | 'opencode'

export function normalizeGatewayBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

export function openaiCompatibleBaseUrl(raw: string): string {
  const normalized = normalizeGatewayBaseUrl(raw)
  if (!normalized) return ''
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

export function formatGatewayApiKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('sk-') ? trimmed : `sk-${trimmed}`
}

export function pickDefaultQuickSetupModel(models: string[]): string {
  const preferred = [
    /claude-sonnet-4/,
    /claude-sonnet/,
    /claude-opus/,
    /sonnet/,
    /claude/,
  ]
  for (const pattern of preferred) {
    const match = models.find((model) => pattern.test(model))
    if (match) return match
  }
  return models[0] ?? ''
}

export function resolveGatewayServerAddress(status: unknown): string {
  if (status && typeof status === 'object') {
    const record = status as Record<string, unknown>
    const nested =
      record.data && typeof record.data === 'object'
        ? (record.data as Record<string, unknown>)
        : undefined
    const candidate =
      record.server_address ??
      record.serverAddress ??
      nested?.server_address ??
      nested?.serverAddress
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeGatewayBaseUrl(candidate)
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeGatewayBaseUrl(window.location.origin)
  }
  return ''
}

function claudeCodeEnv(
  baseUrl: string,
  apiKey: string,
  model: string
): Record<string, string> {
  const resolvedModel = model.trim() || CLAUDE_CODE_MODEL_PLACEHOLDER
  return {
    ANTHROPIC_BASE_URL: normalizeGatewayBaseUrl(baseUrl),
    ANTHROPIC_AUTH_TOKEN:
      formatGatewayApiKey(apiKey) || QUICK_SETUP_API_KEY_PLACEHOLDER,
    ANTHROPIC_MODEL: resolvedModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: resolvedModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: resolvedModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: resolvedModel,
    ANTHROPIC_DEFAULT_FABLE_MODEL: resolvedModel,
  }
}

export function buildClaudeCodeSnippet(input: {
  baseUrl: string
  apiKey: string
  model: string
  format: ClaudeCodeSnippetFormat
}): string {
  const env = claudeCodeEnv(input.baseUrl, input.apiKey, input.model)
  if (input.format === 'shell') {
    return Object.entries(env)
      .map(([key, value]) => `export ${key}='${value.replaceAll("'", "'\\''")}'`)
      .join('\n')
  }
  return `${JSON.stringify({ env }, null, 2)}\n`
}

export function buildOpenCodeSnippet(input: {
  baseUrl: string
  apiKey: string
  model: string
}): string {
  const resolvedModel = input.model.trim() || CLAUDE_CODE_MODEL_PLACEHOLDER
  const config = {
    $schema: 'https://opencode.ai/config.json',
    model: `${OPENCODE_PROVIDER_ID}/${resolvedModel}`,
    provider: {
      [OPENCODE_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'New API',
        options: {
          baseURL: openaiCompatibleBaseUrl(input.baseUrl),
          apiKey:
            formatGatewayApiKey(input.apiKey) ||
            QUICK_SETUP_API_KEY_PLACEHOLDER,
        },
        models: {
          [resolvedModel]: {
            name: resolvedModel,
          },
        },
      },
    },
  }
  return `${JSON.stringify(config, null, 2)}\n`
}
