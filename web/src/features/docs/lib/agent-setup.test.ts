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
import { describe, expect, it } from 'vitest'

import {
  buildClaudeSettings,
  buildCodexConfig,
  buildDshConfig,
  buildDshCredentials,
  buildGeminiEnv,
  buildUnixSetupCommand,
  buildWindowsSetupCommand,
  normalizeGatewayUrl,
  resolveGatewayUrl,
} from './agent-setup'

describe('agent setup helpers', () => {
  it('normalizes trailing slashes from gateway URLs', () => {
    expect(normalizeGatewayUrl(' https://gateway.example.com/proxy/ ')).toBe(
      'https://gateway.example.com/proxy'
    )
    expect(normalizeGatewayUrl('https://gateway.example.com/v1/')).toBe(
      'https://gateway.example.com'
    )
  })

  it('uses the configured server address before the browser origin', () => {
    expect(
      resolveGatewayUrl({ server_address: 'https://gateway.example.com/' })
    ).toBe('https://gateway.example.com')
    expect(resolveGatewayUrl({ server_address: '' })).toBe(
      window.location.origin
    )
  })

  it('builds a one-line PowerShell command for the fixed NekoAI gateway', () => {
    expect(buildWindowsSetupCommand()).toBe(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$p=Join-Path $env:TEMP 'new-api-agent-setup.bat';try{Invoke-WebRequest -UseBasicParsing 'https://ai.nekocore.cn/agent-setup.bat' -OutFile $p -ErrorAction Stop;& $p;exit $LASTEXITCODE}finally{Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue}"`
    )
  })

  it('builds a portable macOS and Linux download command for the fixed gateway', () => {
    expect(buildUnixSetupCommand()).toBe(
      `tmp="$(mktemp)"; curl -fsSL 'https://ai.nekocore.cn/agent-setup.sh' -o "$tmp" && sh "$tmp"; rm -f "$tmp"`
    )
  })

  it('builds Claude and Gemini configuration with the selected gateway', () => {
    const claude = JSON.parse(
      buildClaudeSettings('https://gateway.example.com/', 'sk-test')
    )
    expect(claude.env.ANTHROPIC_BASE_URL).toBe('https://gateway.example.com')
    expect(claude.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test')

    expect(buildGeminiEnv('https://gateway.example.com/', 'sk-test')).toBe(
      [
        'GEMINI_API_KEY=sk-test',
        'GOOGLE_GEMINI_BASE_URL=https://gateway.example.com',
        'GEMINI_MODEL=gemini-2.5-pro',
      ].join('\n')
    )
  })

  it('builds a Codex provider that uses the responses API', () => {
    expect(buildCodexConfig('https://gateway.example.com/', 'sk-test')).toBe(
      [
        'model_provider = "newapi"',
        'model = "gpt-5.6-sol"',
        '',
        '[model_providers.newapi]',
        'name = "NekoAI"',
        'base_url = "https://gateway.example.com/v1"',
        'model_catalog_url = "https://ai.nekocore.cn/codex/models"',
        'wire_api = "responses"',
        'experimental_bearer_token = "sk-test"',
      ].join('\n')
    )
  })

  it('builds DSH provider and credential references', () => {
    expect(buildDshConfig('https://gateway.example.com/')).toBe(
      [
        '- id: llm-pi-ai',
        "  name: '@deepseek-ai/dsh-llm-pi-ai'",
        '  config:',
        '    providers:',
        '      new-api:',
        '        displayName: NekoAI',
        '        apiKeyEnv: NEWAPI_API_KEY',
        '        api: openai-completions',
        "        baseURL: 'https://gateway.example.com/v1'",
        '        compat:',
        '          supportsDeveloperRole: false',
        '          maxTokensField: max_tokens',
        '        models:',
        '          - id: gpt-5.6-sol',
        '- id: agent-default-model',
        "  name: '@deepseek-ai/dsh-agent-default-model'",
        '  config:',
        '    provider: new-api',
        '    model: gpt-5.6-sol',
      ].join('\n')
    )
    expect(buildDshCredentials()).toBe(
      ['version: 1', '', 'refs:', "  NEWAPI_API_KEY: '<YOUR_API_KEY>'"].join(
        '\n'
      )
    )
  })
})
