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
  API_KEY_PLACEHOLDER,
  buildAgentInstallCommand,
  buildApiSnippet,
  buildSdkSnippet,
  detectAgentPlatform,
  getSnippetCopyValue,
  resolveApiEndpoint,
  resolveSnippetModel,
  type SnippetContext,
} from './integration-snippets'

const CHAT: SnippetContext = {
  endpoint: 'https://console.example.ai/v1/chat/completions',
  model: 'gpt-4o-mini',
  kind: 'chat',
  apiKey: 'sk-test',
}

const IMAGE: SnippetContext = { ...CHAT, model: 'gpt-image-2', kind: 'image' }

const VIDEO: SnippetContext = {
  ...CHAT,
  model: 'doubao/doubao-seedance-2-5',
  kind: 'video',
}

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

describe('video snippets', () => {
  test('every language documents both async steps', () => {
    for (const language of ['curl', 'node', 'python'] as const) {
      const snippet = buildApiSnippet(language, VIDEO)

      expect(snippet).toContain('Step 1')
      expect(snippet).toContain('Step 2')
      expect(snippet).toContain('/v1/generation/tasks')
      expect(snippet).not.toContain('/chat/completions')
      expect(snippet).not.toContain('/images/generations')
      expect(snippet).toContain('doubao/doubao-seedance-2-5')
      expect(snippet).toContain('sk-test')
    }
  })

  test('curl submits the task and then polls it by id', () => {
    const snippet = buildApiSnippet('curl', VIDEO)

    expect(snippet).toBe(`# Step 1: Create the video generation task
curl https://console.example.ai/v1/generation/tasks \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-test" \\
  -d '{"model":"doubao/doubao-seedance-2-5","content":[{"type":"text","text":"A beautiful sunset over mountains"}],"ratio":"16:9","duration":5}'

# Step 2: Poll for the result (replace TASK_ID with the id from Step 1)
curl "https://console.example.ai/v1/generation/tasks/TASK_ID" \\
  -H "Authorization: Bearer sk-test"`)
  })

  test('node polls until the task reports a terminal status', () => {
    const snippet = buildApiSnippet('node', VIDEO)

    expect(snippet).toContain("if (data.status === 'succeeded') return data")
    expect(snippet).toContain("data.status === 'failed'")
    expect(snippet).toContain("c.type === 'video_url'")
    // The poll URL interpolates the task id from the bound endpoint.
    expect(snippet).toContain('fetch(`${tasksUrl}/${id}`')
  })

  test('node checks HTTP status and the task id before polling', () => {
    const snippet = buildApiSnippet('node', VIDEO)

    expect(snippet).toContain(
      'if (!createRes.ok) throw new Error(`Create task failed: ${createRes.status}`)'
    )
    expect(snippet).toContain(
      "if (!taskId) throw new Error('Create task response is missing an id')"
    )
    expect(snippet).toContain(
      'if (!res.ok) throw new Error(`Poll failed: ${res.status}`)'
    )
  })

  test('python polls until the task reports a terminal status', () => {
    const snippet = buildApiSnippet('python', VIDEO)

    expect(snippet).toContain('import time')
    expect(snippet).toContain('import requests')
    expect(snippet).toContain('task_id = response.json().get("id")')
    expect(snippet).toContain('f"{TASKS_URL}/{task_id}"')
    expect(snippet).toContain('if data["status"] == "succeeded":')
    expect(snippet).toContain('time.sleep(5)')
  })

  test('python checks HTTP status and the task id before polling', () => {
    const snippet = buildApiSnippet('python', VIDEO)

    const createChunk = snippet.split('# Step 2')[0]
    expect(createChunk).toContain('response.raise_for_status()')
    expect(createChunk).toContain(
      'raise Exception("Create task response is missing an id")'
    )
    expect(snippet).toContain('poll.raise_for_status()')
  })

  test('the sdk tab installs only what the video sample imports', () => {
    expect(
      buildSdkSnippet('python', VIDEO).startsWith('pip install requests')
    ).toBe(true)
    // The video flow uses fetch, so there is no OpenAI SDK to install.
    expect(buildSdkSnippet('node', VIDEO)).toBe(buildApiSnippet('node', VIDEO))
    expect(buildSdkSnippet('node', VIDEO)).not.toContain('npm install openai')
  })

  test('escapes untrusted model ids in every language', () => {
    const hostile: SnippetContext = {
      ...VIDEO,
      model: `seedance"\n`,
    }

    const curlBody = extractBetween(
      buildApiSnippet('curl', hostile),
      "\n  -d '",
      "'\n"
    )
    expect(() => JSON.parse(curlBody)).not.toThrow()

    expect(buildApiSnippet('python', hostile)).toContain(
      '"model": "seedance\\"\\n"'
    )
    // The generated literal must stay a single parseable JS string, not spill
    // the raw newline into the source.
    const nodeBody = extractBetween(
      buildApiSnippet('node', hostile),
      'body: JSON.stringify({',
      '}),'
    )
    assertJavaScriptObjectLiteralIsParseable(nodeBody)
    expect(nodeBody).not.toContain('seedance"\n')
  })

  test('quotes apostrophes in the curl body for a POSIX shell', () => {
    const snippet = buildApiSnippet('curl', { ...VIDEO, model: "seed'ance" })

    expect(snippet).toContain(`seed'"'"'ance`)
  })
})

describe('integration context resolution', () => {
  test('uses the status router address for staging requests', () => {
    expect(
      resolveApiEndpoint(
        'https://staging-router.flatkey.ai',
        'https://staging-console.flatkey.ai'
      )
    ).toBe('https://staging-router.flatkey.ai/v1/chat/completions')
  })

  test('derives the production router address when status is unavailable', () => {
    expect(resolveApiEndpoint(undefined, 'https://console.flatkey.ai')).toBe(
      'https://router.flatkey.ai/v1/chat/completions'
    )
  })

  test('keeps a custom or self-hosted origin as the gateway host', () => {
    expect(resolveApiEndpoint(undefined, 'https://ai.mycompany.com')).toBe(
      'https://ai.mycompany.com/v1/chat/completions'
    )
    expect(resolveApiEndpoint(undefined, 'http://localhost:3000')).toBe(
      'http://localhost:3000/v1/chat/completions'
    )
  })

  test('prefers the status server address over any origin mapping', () => {
    expect(
      resolveApiEndpoint(
        'https://gateway.internal.example',
        'https://console.flatkey.ai'
      )
    ).toBe('https://gateway.internal.example/v1/chat/completions')
  })

  test('does not publish malformed origins as runnable endpoints', () => {
    expect(resolveApiEndpoint(undefined, 'not a valid absolute URL')).toBe(
      'https://router.flatkey.ai/v1/chat/completions'
    )
  })

  test('falls back from a stale model selection', () => {
    const availableModels = ['gpt-4o-mini', 'gpt-5-mini']
    const selectedModel = 'model-from-previous-key'
    expect(
      resolveSnippetModel(selectedModel, availableModels, availableModels[0])
    ).toBe('gpt-4o-mini')
  })

  test('does not publish a default model this key cannot call', () => {
    expect(
      resolveSnippetModel(null, ['claude-sonnet', 'gpt-5-mini'], 'gpt-4o-mini')
    ).toBe('claude-sonnet')
    expect(
      resolveSnippetModel('stale-model', ['claude-sonnet'], 'gpt-4o-mini')
    ).toBe('claude-sonnet')
    // With no model list at all, the fallback is still better than nothing.
    expect(resolveSnippetModel(null, [], 'gpt-4o-mini')).toBe('gpt-4o-mini')
  })

  test('honors the model selected in the picker on every render', () => {
    const selectedModel = resolveSnippetModel(
      'vendor/selected-model',
      ['vendor/selected-model', 'gpt-4o-mini'],
      'gpt-4o-mini'
    )
    const selectedContext: SnippetContext = {
      ...CHAT,
      model: selectedModel,
    }

    expect(selectedModel).toBe('vendor/selected-model')
    expect(resolveSnippetModel(null, [], 'gpt-4o-mini')).toBe('gpt-4o-mini')
    for (const language of ['curl', 'node', 'python'] as const) {
      expect(buildApiSnippet(language, selectedContext)).toContain(
        selectedModel
      )
      expect(buildSdkSnippet(language, selectedContext)).toContain(
        selectedModel
      )
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
  test('copies the placeholder as-is when no API key is selected', () => {
    // Nothing is being resolved, so there is no secret to wait for: the
    // reader takes the snippet and pastes their own credential in.
    const code = `Authorization: Bearer ${API_KEY_PLACEHOLDER}`

    expect(getSnippetCopyValue(code, API_KEY_PLACEHOLDER, null)).toBe(code)
  })

  test('the placeholder is shaped like a key, not a shell variable', () => {
    expect(API_KEY_PLACEHOLDER).toBe('sk-***')
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
    expect(
      getSnippetCopyValue('flatkey login', API_KEY_PLACEHOLDER, null)
    ).toBe('flatkey login')
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
