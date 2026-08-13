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
import { describe, expect, test } from 'bun:test'
import {
  buildAgentInstallCommand,
  buildApiSnippet,
  buildSdkSnippet,
  detectAgentPlatform,
  type SnippetContext,
} from './integration-snippets'

const CHAT: SnippetContext = {
  endpoint: 'https://console.example.ai/v1/chat/completions',
  model: 'gpt-4o-mini',
  kind: 'chat',
  apiKey: 'sk-test',
}

const IMAGE: SnippetContext = { ...CHAT, model: 'gpt-image-2', kind: 'image' }

describe('buildApiSnippet', () => {
  test('curl posts to the chat endpoint with the key and model', () => {
    const snippet = buildApiSnippet('curl', CHAT)

    expect(snippet).toContain(
      'curl https://console.example.ai/v1/chat/completions'
    )
    expect(snippet).toContain('Authorization: Bearer sk-test')
    expect(snippet).toContain('"model":"gpt-4o-mini"')
  })

  test('image models target the images endpoint, not chat completions', () => {
    const snippet = buildApiSnippet('curl', IMAGE)

    expect(snippet).toContain('/v1/images/generations')
    expect(snippet).not.toContain('/chat/completions')
    expect(snippet).toContain('"prompt"')
  })

  test('sdk languages point baseURL at the API root, not the chat path', () => {
    for (const language of ['node', 'python'] as const) {
      const snippet = buildApiSnippet(language, CHAT)

      expect(snippet).toContain('https://console.example.ai/v1')
      expect(snippet).not.toContain('/v1/chat/completions')
      expect(snippet).toContain('sk-test')
    }
  })
})

describe('buildSdkSnippet', () => {
  test('ships the install step ahead of the client setup', () => {
    expect(buildSdkSnippet('node', CHAT).startsWith('npm install openai')).toBe(
      true
    )
    expect(
      buildSdkSnippet('python', CHAT).startsWith('pip install openai')
    ).toBe(true)
  })

  test('curl needs no install step and matches the API snippet', () => {
    expect(buildSdkSnippet('curl', CHAT)).toBe(buildApiSnippet('curl', CHAT))
  })
})

describe('buildAgentInstallCommand', () => {
  test('uses the website origin and drops any trailing slash', () => {
    expect(buildAgentInstallCommand('mac', 'https://site.example/')).toBe(
      'curl -fsSL https://site.example/install.sh | bash'
    )
  })

  test('windows uses the PowerShell script', () => {
    const command = buildAgentInstallCommand('windows', 'https://site.example')

    expect(command).toContain('install.ps1')
    expect(command).toContain('iwr')
  })
})

describe('detectAgentPlatform', () => {
  test('maps user agents to the matching install tab', () => {
    expect(detectAgentPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('windows')
    expect(detectAgentPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(
      'mac'
    )
    expect(detectAgentPlatform('Mozilla/5.0 (X11; Ubuntu)')).toBe('linux')
  })
})
