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
import type { SystemStatus } from '@/features/auth/types'

export type ApiKeyUsageGuideFile = {
  id?: string
  title?: string
  path: string
  language?: string
  content: string
}

export type ApiKeyUsageGuidePlatform = {
  id: string
  name: string
  note?: string
  files: ApiKeyUsageGuideFile[]
}

export type ApiKeyUsageGuideSection = {
  id: string
  name: string
  description?: string
  note?: string
  files?: ApiKeyUsageGuideFile[]
  platforms?: ApiKeyUsageGuidePlatform[]
}

export type ApiKeyUsageGuideConfig = {
  sections: ApiKeyUsageGuideSection[]
}

export type ApiKeyUsageGuideRenderContext = {
  apiKey: string
  apiKeyWithoutPrefix: string
  baseUrl: string
  baseUrlV1: string
  origin: string
  keyName: string
  tokenName: string
}

const CODEX_CONFIG = `model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "{{baseUrl}}"
wire_api = "responses"
requires_openai_auth = true`

const CODEX_AUTH = `{
  "OPENAI_API_KEY": "{{apiKey}}"
}`

const OPENCODE_CONFIG = `{
  "provider": {
    "openai": {
      "options": {
        "baseURL": "{{baseUrlV1}}",
        "apiKey": "{{apiKey}}"
      },
      "models": {
        "gpt-5.4": {
          "name": "GPT-5.4",
          "limit": {
            "context": 1000000,
            "output": 128000
          },
          "options": {
            "store": false
          },
          "variants": {
            "low": {},
            "medium": {},
            "high": {},
            "xhigh": {}
          }
        }
      }
    }
  },
  "$schema": "https://opencode.ai/config.json"
}`

const codexMacLinuxFiles: ApiKeyUsageGuideFile[] = [
  {
    id: 'config',
    title: 'config.toml',
    path: '~/.codex/config.toml',
    language: 'toml',
    content: CODEX_CONFIG,
  },
  {
    id: 'auth',
    title: 'auth.json',
    path: '~/.codex/auth.json',
    language: 'json',
    content: CODEX_AUTH,
  },
]

const codexWindowsFiles: ApiKeyUsageGuideFile[] = [
  {
    id: 'config',
    title: 'config.toml',
    path: '%userprofile%\\.codex\\config.toml',
    language: 'toml',
    content: CODEX_CONFIG,
  },
  {
    id: 'auth',
    title: 'auth.json',
    path: '%userprofile%\\.codex\\auth.json',
    language: 'json',
    content: CODEX_AUTH,
  },
]

export const DEFAULT_API_KEY_USAGE_GUIDE_CONFIG: ApiKeyUsageGuideConfig = {
  sections: [
    {
      id: 'codex-app',
      name: 'Codex App',
      description:
        'Add these files to the Codex configuration directory, then restart Codex App.',
      platforms: [
        {
          id: 'mac-linux',
          name: 'macOS / Linux',
          note: 'Create the directory first if it does not exist: mkdir -p ~/.codex',
          files: codexMacLinuxFiles,
        },
        {
          id: 'windows',
          name: 'Windows',
          note: 'Open %userprofile%\\.codex from Win+R, and create the directory first if it does not exist.',
          files: codexWindowsFiles,
        },
      ],
    },
    {
      id: 'codex-cli',
      name: 'Codex CLI',
      description:
        'Use these files for Codex CLI. Adjust the model name if your account uses a different default model.',
      platforms: [
        {
          id: 'mac-linux',
          name: 'macOS / Linux',
          note: 'Create the directory first if it does not exist: mkdir -p ~/.codex',
          files: codexMacLinuxFiles,
        },
        {
          id: 'windows',
          name: 'Windows',
          note: 'Open %userprofile%\\.codex from Win+R, and create the directory first if it does not exist.',
          files: codexWindowsFiles,
        },
      ],
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      description:
        'Create or update opencode.json. You can expand the models block as needed.',
      files: [
        {
          id: 'opencode-json',
          title: 'opencode.json',
          path: '~/.config/opencode/opencode.json',
          language: 'json',
          content: OPENCODE_CONFIG,
        },
      ],
    },
  ],
}

export const DEFAULT_API_KEY_USAGE_GUIDE_JSON = JSON.stringify(
  DEFAULT_API_KEY_USAGE_GUIDE_CONFIG,
  null,
  2
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isUsageGuideFile(value: unknown): value is ApiKeyUsageGuideFile {
  if (!isRecord(value)) return false
  return isString(value.path) && isString(value.content)
}

function isUsageGuidePlatform(
  value: unknown
): value is ApiKeyUsageGuidePlatform {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.files) &&
    value.files.length > 0 &&
    value.files.every(isUsageGuideFile)
  )
}

export function isApiKeyUsageGuideConfig(
  value: unknown
): value is ApiKeyUsageGuideConfig {
  if (!isRecord(value) || !Array.isArray(value.sections)) return false
  if (value.sections.length === 0) return false

  return value.sections.every((section) => {
    if (!isRecord(section)) return false
    if (!isString(section.id) || !isString(section.name)) return false

    const hasFiles =
      Array.isArray(section.files) &&
      section.files.length > 0 &&
      section.files.every(isUsageGuideFile)
    const hasPlatforms =
      Array.isArray(section.platforms) &&
      section.platforms.length > 0 &&
      section.platforms.every(isUsageGuidePlatform)

    return hasFiles || hasPlatforms
  })
}

export function parseApiKeyUsageGuideConfig(
  raw?: string | null
): ApiKeyUsageGuideConfig {
  if (!raw || !raw.trim()) return DEFAULT_API_KEY_USAGE_GUIDE_CONFIG

  try {
    const parsed = JSON.parse(raw)
    if (isApiKeyUsageGuideConfig(parsed)) return parsed
  } catch {
    /* empty */
  }

  return DEFAULT_API_KEY_USAGE_GUIDE_CONFIG
}

export function validateApiKeyUsageGuideJson(raw: string): boolean {
  if (!raw.trim()) return true
  try {
    return isApiKeyUsageGuideConfig(JSON.parse(raw))
  } catch {
    return false
  }
}

export function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw) as Record<string, unknown>
      const serverAddress =
        status.server_address ??
        status.serverAddress ??
        (isRecord(status.data) ? status.data.server_address : undefined) ??
        (isRecord(status.data) ? status.data.serverAddress : undefined)
      if (typeof serverAddress === 'string' && serverAddress) {
        return serverAddress
      }
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

export function getBaseUrlV1(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  if (normalized.endsWith('/v1')) return normalized
  return `${normalized}/v1`
}

export function extractApiKeyUsageGuideJson(
  status: SystemStatus | null
): string | undefined {
  const direct = status?.api_key_usage_tips
  if (typeof direct === 'string') return direct

  const nested = status?.data?.api_key_usage_tips
  if (typeof nested === 'string') return nested

  if (typeof window === 'undefined') return undefined

  try {
    const raw = window.localStorage.getItem('status')
    if (!raw) return undefined
    const stored = JSON.parse(raw) as Record<string, unknown>
    const storedValue =
      stored.api_key_usage_tips ??
      (isRecord(stored.data) ? stored.data.api_key_usage_tips : undefined)
    if (typeof storedValue === 'string') return storedValue
  } catch {
    /* empty */
  }

  return undefined
}

export function buildUsageGuideRenderContext(
  apiKey: string,
  keyName: string
): ApiKeyUsageGuideRenderContext {
  const baseUrl = getServerAddress()
  const normalizedApiKey = apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`
  const apiKeyWithoutPrefix = normalizedApiKey.replace(/^sk-/, '')

  return {
    apiKey: normalizedApiKey,
    apiKeyWithoutPrefix,
    baseUrl,
    baseUrlV1: getBaseUrlV1(baseUrl),
    origin: typeof window === 'undefined' ? baseUrl : window.location.origin,
    keyName,
    tokenName: keyName,
  }
}

export function renderUsageGuideTemplate(
  content: string,
  context: ApiKeyUsageGuideRenderContext
): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key as keyof ApiKeyUsageGuideRenderContext]
    return typeof value === 'string' ? value : ''
  })
}
