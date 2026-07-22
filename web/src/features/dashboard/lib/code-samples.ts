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
/**
 * Builders for "first request" code samples shown on the overview dashboard.
 * Each builder returns a copy-ready snippet preserved with explicit newlines.
 */
export interface CodeSampleArgs {
  endpoint: string
  apiKey: string
  model: string
}

export type CodeSampleLanguage = 'curl' | 'python' | 'javascript' | 'go'

export function buildCurlCommand(args: CodeSampleArgs): string {
  return [
    `curl ${args.endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${args.apiKey}" \\`,
    `  -d '{"model":"${args.model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

export function buildPythonSnippet(args: CodeSampleArgs): string {
  return [
    'from openai import OpenAI',
    '',
    'client = OpenAI(',
    `    base_url="${args.endpoint.replace(/\/chat\/completions$/, '')}",`,
    `    api_key="${args.apiKey}",`,
    ')',
    '',
    'response = client.chat.completions.create(',
    `    model="${args.model}",`,
    '    messages=[{"role": "user", "content": "Say hello in one sentence."}],',
    ')',
    'print(response.choices[0].message.content)',
  ].join('\n')
}

export function buildJavaScriptSnippet(args: CodeSampleArgs): string {
  return [
    "import OpenAI from 'openai'",
    '',
    'const client = new OpenAI({',
    `  baseURL: '${args.endpoint.replace(/\/chat\/completions$/, '')}',`,
    `  apiKey: '${args.apiKey}',`,
    '})',
    '',
    'const response = await client.chat.completions.create({',
    `  model: '${args.model}',`,
    "  messages: [{ role: 'user', content: 'Say hello in one sentence.' }],",
    '})',
    'console.log(response.choices[0].message.content)',
  ].join('\n')
}

export function buildGoSnippet(args: CodeSampleArgs): string {
  return [
    'package main',
    '',
    'import (',
    '\t"context"',
    '\t"fmt"',
    '\t"github.com/sashabaranov/go-openai"',
    ')',
    '',
    'func main() {',
    `\tcfg := openai.DefaultConfig("${args.apiKey}")`,
    `\tcfg.BaseURL = "${args.endpoint.replace(/\/chat\/completions$/, '')}"`,
    '\tclient := openai.NewClientWithConfig(cfg)',
    '',
    '\tresp, err := client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{',
    `\t\tModel: "${args.model}",`,
    '\t\tMessages: []openai.ChatCompletionMessage{{Role: "user", Content: "Say hello in one sentence."}},',
    '\t})',
    '\tif err != nil { panic(err) }',
    '\tfmt.Println(resp.Choices[0].Message.Content)',
    '}',
  ].join('\n')
}

export function buildCodeSample(
  language: CodeSampleLanguage,
  args: CodeSampleArgs
): string {
  switch (language) {
    case 'python':
      return buildPythonSnippet(args)
    case 'javascript':
      return buildJavaScriptSnippet(args)
    case 'go':
      return buildGoSnippet(args)
    case 'curl':
    default:
      return buildCurlCommand(args)
  }
}

/** Mask an API key for display (preserve prefix + suffix only). */
export function formatDisplayKey(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

/** Normalize an upstream endpoint URL to the v1 chat completions path. */
export function normalizeChatCompletionsEndpoint(sourceUrl?: string): string {
  const origin =
    typeof window === 'undefined' ? '' : window.location.origin
  const fallback = `${origin}/v1/chat/completions`
  const trimmed = sourceUrl?.trim()
  if (!trimmed) return fallback

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (withoutTrailingSlash.endsWith('/v1/chat/completions')) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith('/v1')) {
    return `${withoutTrailingSlash}/chat/completions`
  }
  return `${withoutTrailingSlash}/v1/chat/completions`
}
