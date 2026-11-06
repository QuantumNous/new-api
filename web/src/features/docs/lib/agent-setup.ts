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
import type { StatusData } from '@/lib/status-query'

export const DEFAULT_CODEX_MODEL = 'gpt-5.6-sol'
export const DEFAULT_DSH_MODEL = 'gpt-5.6-sol'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro'
export const SETUP_GATEWAY_URL = 'https://ai.nekocore.cn'
export const SETUP_PROVIDER_NAME = 'NekoAI'

export function normalizeGatewayUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '')
  return normalized.replace(/\/v1$/i, '').replace(/\/+$/, '')
}

export function resolveGatewayUrl(status?: StatusData | null): string {
  const configured =
    typeof status?.server_address === 'string'
      ? status.server_address.trim()
      : ''
  const fallback = typeof window === 'undefined' ? '' : window.location.origin
  return normalizeGatewayUrl(configured || fallback)
}

export function buildWindowsSetupCommand(): string {
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$p=Join-Path $env:TEMP 'new-api-agent-setup.bat';try{Invoke-WebRequest -UseBasicParsing '${SETUP_GATEWAY_URL}/agent-setup.bat' -OutFile $p -ErrorAction Stop;& $p;exit $LASTEXITCODE}finally{Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue}"`
}

export function buildUnixSetupCommand(): string {
  return `tmp="$(mktemp)"; curl -fsSL '${SETUP_GATEWAY_URL}/agent-setup.sh' -o "$tmp" && sh "$tmp"; rm -f "$tmp"`
}

export function buildClaudeSettings(
  gatewayUrl: string,
  apiKey = '<YOUR_API_KEY>'
): string {
  return JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: normalizeGatewayUrl(gatewayUrl),
        ANTHROPIC_AUTH_TOKEN: apiKey,
      },
    },
    null,
    2
  )
}

function escapeTomlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function buildCodexConfig(
  gatewayUrl: string,
  apiKey = '<YOUR_API_KEY>'
): string {
  const gateway = normalizeGatewayUrl(gatewayUrl)
  return [
    'model_provider = "newapi"',
    `model = "${DEFAULT_CODEX_MODEL}"`,
    '',
    '[model_providers.newapi]',
    `name = "${SETUP_PROVIDER_NAME}"`,
    `base_url = "${escapeTomlString(`${gateway}/v1`)}"`,
    'wire_api = "responses"',
    `experimental_bearer_token = "${escapeTomlString(apiKey)}"`,
  ].join('\n')
}

export function buildGeminiEnv(
  gatewayUrl: string,
  apiKey = '<YOUR_API_KEY>'
): string {
  return [
    `GEMINI_API_KEY=${apiKey}`,
    `GOOGLE_GEMINI_BASE_URL=${normalizeGatewayUrl(gatewayUrl)}`,
    `GEMINI_MODEL=${DEFAULT_GEMINI_MODEL}`,
  ].join('\n')
}

export function buildGeminiSettings(): string {
  return JSON.stringify(
    {
      security: {
        auth: {
          selectedType: 'gemini-api-key',
        },
      },
      model: {
        name: DEFAULT_GEMINI_MODEL,
      },
    },
    null,
    2
  )
}

export function buildDshConfig(gatewayUrl: string): string {
  const gateway = normalizeGatewayUrl(gatewayUrl)
  return [
    '- id: llm-pi-ai',
    "  name: '@deepseek-ai/dsh-llm-pi-ai'",
    '  config:',
    '    providers:',
    '      new-api:',
    `        displayName: ${SETUP_PROVIDER_NAME}`,
    '        apiKeyEnv: NEWAPI_API_KEY',
    '        api: openai-completions',
    `        baseURL: '${gateway}/v1'`,
    '        compat:',
    '          supportsDeveloperRole: false',
    '          maxTokensField: max_tokens',
    '        models:',
    `          - id: ${DEFAULT_DSH_MODEL}`,
    '- id: agent-default-model',
    "  name: '@deepseek-ai/dsh-agent-default-model'",
    '  config:',
    '    provider: new-api',
    `    model: ${DEFAULT_DSH_MODEL}`,
  ].join('\n')
}

export function buildDshCredentials(apiKey = '<YOUR_API_KEY>'): string {
  return ['version: 1', '', 'refs:', `  NEWAPI_API_KEY: '${apiKey}'`].join('\n')
}
