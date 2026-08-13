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
export type IntegrationId = 'api' | 'sdk' | 'cli' | 'agent'

export type ApiLanguage = 'curl' | 'node' | 'python'

export type AgentPlatform = 'mac' | 'linux' | 'windows'

export type SnippetKind = 'chat' | 'image' | 'video'

/**
 * Stands in for the key when the account has none yet. It is shaped like a
 * real key so the sample still reads as a complete command, and it is copied
 * verbatim — a reader with no key should still be able to take the snippet
 * away and paste their own credential into it.
 */
export const API_KEY_PLACEHOLDER = 'sk-***'

export interface SnippetContext {
  /** Chat completions endpoint, e.g. https://host/v1/chat/completions */
  endpoint: string
  model: string
  kind: SnippetKind
  apiKey: string
}

const DEFAULT_ROUTER_ORIGIN = 'https://router.flatkey.ai'

function normalizeOrigin(source: string | undefined): string {
  return source?.trim().replace(/\/+$/, '') ?? ''
}

function inferRouterOrigin(browserOrigin: string | undefined): string {
  const origin = normalizeOrigin(browserOrigin)
  if (!origin) return DEFAULT_ROUTER_ORIGIN

  try {
    const url = new URL(origin)
    if (url.hostname.startsWith('staging-console.')) {
      url.hostname = url.hostname.replace(
        /^staging-console\./,
        'staging-router.'
      )
    } else if (url.hostname.startsWith('console.')) {
      url.hostname = url.hostname.replace(/^console\./, 'router.')
    }
    // Any other origin (custom domain, private deployment, local preview)
    // serves the gateway from the same host, so keep it instead of pointing
    // the copyable command at the public production router.
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return normalizeOrigin(url.toString())
  } catch {
    return DEFAULT_ROUTER_ORIGIN
  }
}

function normalizeChatEndpoint(source: string | undefined): string {
  const origin = normalizeOrigin(source)
  if (!origin) return ''
  if (origin.endsWith('/v1/chat/completions')) return origin
  if (origin.endsWith('/v1')) return `${origin}/chat/completions`
  return `${origin}/v1/chat/completions`
}

/**
 * Resolve the public model-router endpoint used by copyable examples.
 * `/api/status.server_address` is authoritative. If status is unavailable,
 * known console origins are converted to their router hostnames; every other
 * origin (custom domain, private deployment) is kept as the gateway host.
 */
export function resolveApiEndpoint(
  serverAddress: string | undefined,
  browserOrigin: string | undefined
): string {
  return (
    normalizeChatEndpoint(serverAddress) ||
    normalizeChatEndpoint(inferRouterOrigin(browserOrigin))
  )
}

/** Keep the picker selection authoritative over the initial example default. */
export function resolveSnippetModel(
  selectedModel: string | null | undefined,
  availableModels: string[],
  fallbackModel: string
): string {
  const selected = selectedModel?.trim()
  if (selected && availableModels.includes(selected)) return selected
  // The default example model may not be callable with the current key, so
  // it goes through the same availability check before being published.
  if (availableModels.length === 0 || availableModels.includes(fallbackModel)) {
    return fallbackModel
  }
  return availableModels[0]
}

function toBaseUrl(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/chat\/completions$/, '')
}

function toImagesEndpoint(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/chat\/completions$/, '/images/generations')
}

/** Async video submit route; the result is polled from `${it}/{task_id}`. */
function toVideoTasksEndpoint(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/chat\/completions$/, '/generation/tasks')
}

const CHAT_PROMPT = 'Say hello in one sentence.'
const IMAGE_PROMPT = 'A cute cat'
const VIDEO_PROMPT = 'A beautiful sunset over mountains'
const VIDEO_RATIO = '16:9'
const VIDEO_DURATION = 5
/** Matches the upstream task cadence used by the reference integrations. */
const VIDEO_POLL_INTERVAL_SECONDS = 5

function toDoubleQuotedString(value: string): string {
  return JSON.stringify(value)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function toJavaScriptString(value: string): string {
  const jsonContents = toDoubleQuotedString(value).slice(1, -1)
  return `'${jsonContents.replaceAll("'", "\\'")}'`
}

function toShellSingleQuoted(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function buildCurl(ctx: SnippetContext): string {
  if (ctx.kind === 'video') return buildVideoCurl(ctx)

  const endpoint =
    ctx.kind === 'image' ? toImagesEndpoint(ctx.endpoint) : ctx.endpoint
  const body = JSON.stringify(
    ctx.kind === 'image'
      ? { model: ctx.model, prompt: IMAGE_PROMPT, size: '1024x1024' }
      : {
          model: ctx.model,
          messages: [{ role: 'user', content: CHAT_PROMPT }],
        }
  )

  return [
    `curl ${endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${ctx.apiKey}" \\`,
    `  -d ${toShellSingleQuoted(body)}`,
  ].join('\n')
}

/**
 * Video generation is asynchronous: one call submits a task, a second polls it
 * until the URL is ready. Both steps are shown so the sample is runnable as-is
 * instead of returning a task id the reader has to figure out what to do with.
 */
function buildVideoCurl(ctx: SnippetContext): string {
  const tasksEndpoint = toVideoTasksEndpoint(ctx.endpoint)
  const body = JSON.stringify({
    model: ctx.model,
    content: [{ type: 'text', text: VIDEO_PROMPT }],
    ratio: VIDEO_RATIO,
    duration: VIDEO_DURATION,
  })

  return [
    '# Step 1: Create the video generation task',
    `curl ${tasksEndpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${ctx.apiKey}" \\`,
    `  -d ${toShellSingleQuoted(body)}`,
    '',
    '# Step 2: Poll for the result (replace TASK_ID with the id from Step 1)',
    `curl "${tasksEndpoint}/TASK_ID" \\`,
    `  -H "Authorization: Bearer ${ctx.apiKey}"`,
  ].join('\n')
}

function buildNode(ctx: SnippetContext): string {
  if (ctx.kind === 'video') return buildVideoNode(ctx)

  const baseUrl = toBaseUrl(ctx.endpoint)
  const client = [
    "import OpenAI from 'openai'",
    '',
    'const client = new OpenAI({',
    `  apiKey: ${toJavaScriptString(ctx.apiKey)},`,
    `  baseURL: ${toJavaScriptString(baseUrl)},`,
    '})',
    '',
  ]

  if (ctx.kind === 'image') {
    return [
      ...client,
      'const image = await client.images.generate({',
      `  model: ${toJavaScriptString(ctx.model)},`,
      `  prompt: ${toJavaScriptString(IMAGE_PROMPT)},`,
      "  size: '1024x1024',",
      '})',
      '',
      'console.log(image.data[0].url)',
    ].join('\n')
  }

  return [
    ...client,
    'const completion = await client.chat.completions.create({',
    `  model: ${toJavaScriptString(ctx.model)},`,
    `  messages: [{ role: 'user', content: ${toJavaScriptString(CHAT_PROMPT)} }],`,
    '})',
    '',
    'console.log(completion.choices[0].message.content)',
  ].join('\n')
}

function buildPython(ctx: SnippetContext): string {
  if (ctx.kind === 'video') return buildVideoPython(ctx)

  const baseUrl = toBaseUrl(ctx.endpoint)
  const client = [
    'from openai import OpenAI',
    '',
    'client = OpenAI(',
    `    api_key=${toDoubleQuotedString(ctx.apiKey)},`,
    `    base_url=${toDoubleQuotedString(baseUrl)},`,
    ')',
    '',
  ]

  if (ctx.kind === 'image') {
    return [
      ...client,
      'image = client.images.generate(',
      `    model=${toDoubleQuotedString(ctx.model)},`,
      `    prompt=${toDoubleQuotedString(IMAGE_PROMPT)},`,
      '    size="1024x1024",',
      ')',
      '',
      'print(image.data[0].url)',
    ].join('\n')
  }

  return [
    ...client,
    'completion = client.chat.completions.create(',
    `    model=${toDoubleQuotedString(ctx.model)},`,
    `    messages=[{"role": "user", "content": ${toDoubleQuotedString(CHAT_PROMPT)}}],`,
    ')',
    '',
    'print(completion.choices[0].message.content)',
  ].join('\n')
}

function buildVideoNode(ctx: SnippetContext): string {
  const tasksEndpoint = toVideoTasksEndpoint(ctx.endpoint)
  const authHeader = toJavaScriptString(`Bearer ${ctx.apiKey}`)

  return [
    // The endpoint is bound once so the poll URL can interpolate the task id
    // without embedding a raw URL inside a template literal.
    `const tasksUrl = ${toJavaScriptString(tasksEndpoint)}`,
    '',
    '// Step 1: Create the video generation task',
    'const createRes = await fetch(tasksUrl, {',
    "  method: 'POST',",
    '  headers: {',
    `    Authorization: ${authHeader},`,
    "    'Content-Type': 'application/json',",
    '  },',
    '  body: JSON.stringify({',
    `    model: ${toJavaScriptString(ctx.model)},`,
    `    content: [{ type: 'text', text: ${toJavaScriptString(VIDEO_PROMPT)} }],`,
    `    ratio: ${toJavaScriptString(VIDEO_RATIO)},`,
    `    duration: ${VIDEO_DURATION},`,
    '  }),',
    '})',
    'if (!createRes.ok) throw new Error(`Create task failed: ${createRes.status}`)',
    'const { id: taskId } = await createRes.json()',
    "if (!taskId) throw new Error('Create task response is missing an id')",
    '',
    '// Step 2: Poll until the task succeeds',
    'async function pollTask(id) {',
    '  while (true) {',
    '    const res = await fetch(`${tasksUrl}/${id}`, {',
    `      headers: { Authorization: ${authHeader} },`,
    '    })',
    '    if (!res.ok) throw new Error(`Poll failed: ${res.status}`)',
    '    const data = await res.json()',
    "    if (data.status === 'succeeded') return data",
    "    if (data.status === 'failed') throw new Error('Generation failed')",
    `    await new Promise((r) => setTimeout(r, ${VIDEO_POLL_INTERVAL_SECONDS * 1000}))`,
    '  }',
    '}',
    '',
    'const result = await pollTask(taskId)',
    "const videoUrl = result.content?.find((c) => c.type === 'video_url')?.video_url?.url",
    '',
    "console.log('Video URL:', videoUrl)",
  ].join('\n')
}

function buildVideoPython(ctx: SnippetContext): string {
  const tasksEndpoint = toVideoTasksEndpoint(ctx.endpoint)
  const authHeader = toDoubleQuotedString(`Bearer ${ctx.apiKey}`)

  return [
    'import time',
    '',
    'import requests',
    '',
    // Bound once so the poll f-string never has to nest a quoted URL, which
    // is a syntax error before Python 3.12.
    `TASKS_URL = ${toDoubleQuotedString(tasksEndpoint)}`,
    '',
    '# Step 1: Create the video generation task',
    'response = requests.post(',
    '    TASKS_URL,',
    `    headers={"Authorization": ${authHeader}, "Content-Type": "application/json"},`,
    '    json={',
    `        "model": ${toDoubleQuotedString(ctx.model)},`,
    `        "content": [{"type": "text", "text": ${toDoubleQuotedString(VIDEO_PROMPT)}}],`,
    `        "ratio": ${toDoubleQuotedString(VIDEO_RATIO)},`,
    `        "duration": ${VIDEO_DURATION},`,
    '    },',
    ')',
    'response.raise_for_status()',
    'task_id = response.json().get("id")',
    'if not task_id:',
    '    raise Exception("Create task response is missing an id")',
    '',
    '# Step 2: Poll until the task succeeds',
    'while True:',
    '    poll = requests.get(',
    '        f"{TASKS_URL}/{task_id}",',
    `        headers={"Authorization": ${authHeader}},`,
    '    )',
    '    poll.raise_for_status()',
    '    data = poll.json()',
    '    if data["status"] == "succeeded":',
    '        video_url = next(',
    '            c["video_url"]["url"] for c in data["content"] if c["type"] == "video_url"',
    '        )',
    '        print("Video URL:", video_url)',
    '        break',
    '    if data["status"] == "failed":',
    '        raise Exception("Generation failed")',
    `    time.sleep(${VIDEO_POLL_INTERVAL_SECONDS})`,
  ].join('\n')
}

export function buildApiSnippet(
  language: ApiLanguage,
  ctx: SnippetContext
): string {
  if (language === 'node') return buildNode(ctx)
  if (language === 'python') return buildPython(ctx)
  return buildCurl(ctx)
}

/**
 * The SDK card differs from the API card by shipping the dependency install
 * alongside the client setup, so the sample is runnable from an empty project.
 * Video generation is async and not covered by the OpenAI SDK, so its samples
 * install only what they actually import.
 */
export function buildSdkSnippet(
  language: ApiLanguage,
  ctx: SnippetContext
): string {
  if (language === 'node') {
    if (ctx.kind === 'video') return buildNode(ctx)
    return ['npm install openai', '', buildNode(ctx)].join('\n')
  }
  if (language === 'python') {
    const install =
      ctx.kind === 'video' ? 'pip install requests' : 'pip install openai'
    return [install, '', buildPython(ctx)].join('\n')
  }
  return buildCurl(ctx)
}

/**
 * Snippets render a masked key but copy the real one. Copying is withheld
 * only while a genuine key is being resolved — handing over a masked secret
 * would produce a command that fails in a confusing way. With no key selected
 * at all there is nothing to resolve, so the placeholder is copied as-is and
 * the reader substitutes their own credential.
 */
export function getSnippetCopyValue(
  code: string,
  displayedKey: string,
  selectedKeyId: number | null,
  resolvedKey?: string
): string | undefined {
  if (!displayedKey || !code.includes(displayedKey)) return code
  if (selectedKeyId === null) return code
  if (!resolvedKey) return undefined
  return code.replaceAll(displayedKey, () => resolvedKey)
}

export const CLI_INSTALL_COMMAND = 'npm i -g @flatkey-ai/cli'
export const CLI_LOGIN_COMMAND = 'flatkey login'

const AGENT_INSTALL_COMMANDS: Record<AgentPlatform, string> = {
  mac: 'curl -fsSL {{origin}}/install.sh | bash',
  linux: 'curl -fsSL {{origin}}/install.sh | bash',
  windows: 'iwr {{origin}}/install.ps1 -UseBasicParsing | iex',
}

export function buildAgentInstallCommand(
  platform: AgentPlatform,
  websiteOrigin: string
): string {
  return AGENT_INSTALL_COMMANDS[platform].replace(
    '{{origin}}',
    websiteOrigin.replace(/\/+$/, '')
  )
}

export function detectAgentPlatform(userAgent: string): AgentPlatform {
  const ua = userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  return 'linux'
}
