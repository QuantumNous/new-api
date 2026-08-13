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

export type SnippetKind = 'chat' | 'image'

export const API_KEY_PLACEHOLDER = 'FLATKEY_API_KEY'

export interface SnippetContext {
  /** Chat completions endpoint, e.g. https://host/v1/chat/completions */
  endpoint: string
  model: string
  kind: SnippetKind
  apiKey: string
}

function toBaseUrl(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/chat\/completions$/, '')
}

function toImagesEndpoint(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/chat\/completions$/, '/images/generations')
}

const CHAT_PROMPT = 'Say hello in one sentence.'
const IMAGE_PROMPT = 'A cute cat'

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

function buildNode(ctx: SnippetContext): string {
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
 */
export function buildSdkSnippet(
  language: ApiLanguage,
  ctx: SnippetContext
): string {
  if (language === 'node') {
    return ['npm install openai', '', buildNode(ctx)].join('\n')
  }
  if (language === 'python') {
    return ['pip install openai', '', buildPython(ctx)].join('\n')
  }
  return buildCurl(ctx)
}

export function getSnippetCopyValue(
  code: string,
  displayedKey: string,
  selectedKeyId: number | null,
  resolvedKey?: string
): string | undefined {
  if (!displayedKey || !code.includes(displayedKey)) return code
  if (selectedKeyId === null || !resolvedKey) return undefined
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
