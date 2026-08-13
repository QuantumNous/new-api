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
  getSnippetCopyValue,
  type SnippetContext,
} from './integration-snippets'

const CHAT: SnippetContext = {
  endpoint: 'https://console.example.ai/v1/chat/completions',
  model: 'gpt-4o-mini',
  kind: 'chat',
  apiKey: 'sk-test',
}

const IMAGE: SnippetContext = { ...CHAT, model: 'gpt-image-2', kind: 'image' }

function extractBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)

  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)

  return source.slice(startIndex + start.length, endIndex)
}

function assertJavaScriptObjectLiteralIsParseable(source: string): void {
  expect(() => new Function(`return ({${source}})`)).not.toThrow()
}

describe('buildApiSnippet', () => {
  test('keeps curl JSON parseable when models contain quotes and newlines', () => {
    const ctx: SnippetContext = {
      endpoint: 'https://console.example.ai/v1/chat/completions',
      model: `gpt-4o-mini"\n`,
      kind: 'chat',
      apiKey: 'sk-test',
    }

    const curl = buildApiSnippet('curl', ctx)
    const body = extractBetween(curl, "\n  -d '", "'")

    expect(() => JSON.parse(body)).not.toThrow()
  })

  test('quotes apostrophes in curl JSON for a POSIX shell', () => {
    const snippet = buildApiSnippet('curl', {
      ...CHAT,
      model: "gpt-o'mini",
    })

    expect(snippet).toContain(`gpt-o'"'"'mini`)
  })

  test('keeps node snippets parseable when api keys or models contain quotes and newlines', () => {
    const ctx: SnippetContext = {
      endpoint: 'https://console.example.ai/v1/chat/completions',
      model: `gpt-4o-mini'\n`,
      kind: 'chat',
      apiKey: `sk-test'\n`,
    }

    const node = buildApiSnippet('node', ctx)
    const clientChunk = extractBetween(
      node,
      'const client = new OpenAI({',
      '})'
    )
    const requestChunk = extractBetween(
      node,
      'const completion = await client.chat.completions.create({',
      '})'
    )

    assertJavaScriptObjectLiteralIsParseable(clientChunk)
    assertJavaScriptObjectLiteralIsParseable(requestChunk)
  })

  test('escapes quotes and newlines in python string literals', () => {
    const ctx: SnippetContext = {
      endpoint: 'https://console.example.ai/v1/chat/completions',
      model: `gpt-4o-mini"\n`,
      kind: 'chat',
      apiKey: `sk-test"\n`,
    }

    const python = buildApiSnippet('python', ctx)

    expect(python).toContain('api_key="sk-test\\"\\n",')
    expect(python).toContain('model="gpt-4o-mini\\"\\n",')
    expect(python).not.toContain(`api_key="${ctx.apiKey}",`)
    expect(python).not.toContain(`model="${ctx.model}",`)
  })

  test('curl posts to the chat endpoint with the key and model', () => {
    const snippet = buildApiSnippet('curl', CHAT)

    expect(snippet).toContain(
      'curl https://console.example.ai/v1/chat/completions'
    )
    expect(snippet).toContain('Authorization: Bearer sk-test')
    expect(snippet).toContain('"model":"gpt-4o-mini"')
  })

  test('matches the staging-ready chat examples in every language tab', () => {
    expect(buildApiSnippet('curl', CHAT))
      .toBe(`curl https://console.example.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-test" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`)

    expect(buildApiSnippet('node', CHAT)).toBe(`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: 'sk-test',
  baseURL: 'https://console.example.ai/v1',
})

const completion = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
})

console.log(completion.choices[0].message.content)`)

    expect(buildApiSnippet('python', CHAT)).toBe(`from openai import OpenAI

client = OpenAI(
    api_key="sk-test",
    base_url="https://console.example.ai/v1",
)

completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Say hello in one sentence."}],
)

print(completion.choices[0].message.content)`)
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

describe('getSnippetCopyValue', () => {
  test('does not copy a placeholder when no API key is selected', () => {
    expect(
      getSnippetCopyValue(
        'Authorization: Bearer FLATKEY_API_KEY',
        'FLATKEY_API_KEY',
        null
      )
    ).toBeUndefined()
  })

  test('replaces the masked key only after the real key is resolved', () => {
    const code = 'Authorization: Bearer sk-test********tail'

    expect(getSnippetCopyValue(code, 'sk-test********tail', 7)).toBeUndefined()
    expect(
      getSnippetCopyValue(code, 'sk-test********tail', 7, 'sk-real-secret')
    ).toBe('Authorization: Bearer sk-real-secret')
  })

  test('copies replacement keys literally when they contain dollar signs', () => {
    expect(
      getSnippetCopyValue(
        'Authorization: Bearer sk-masked',
        'sk-masked',
        7,
        'sk-$&-literal'
      )
    ).toBe('Authorization: Bearer sk-$&-literal')
  })

  test('keeps snippets that do not need an API key copyable', () => {
    expect(getSnippetCopyValue('flatkey login', 'FLATKEY_API_KEY', null)).toBe(
      'flatkey login'
    )
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
