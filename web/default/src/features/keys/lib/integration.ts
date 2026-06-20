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
import type { SimplePurposeId } from '../types'

/**
 * Shared integration-guide helpers used by both the create-time success
 * dialog and the persistent "Setup guide" wizard. Keeping the Base URL /
 * model-name / code-snippet logic in one place stops the three entry points
 * (success dialog, /keys header button, per-row dropdown) from drifting.
 */

/** Placeholder shown when the wizard is opened without a resolved key. */
export const API_KEY_PLACEHOLDER = 'YOUR_DEEPROUTER_API_KEY'

export function defaultBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://deeprouter.ai/v1'
  const { protocol, host } = window.location
  return `${protocol}//${host}/v1`
}

/**
 * The ONLY model name the gateway routes today is the `deeprouter-auto`
 * virtual model (smart-router). Purpose-specific aliases (deeprouter-coding /
 * -image / …) and the bare `deeprouter` name are NOT provisioned and return
 * 503 — verified against a live gateway 2026-06-11. Per CLAUDE.md §0 rule 3,
 * never surface a model name here without re-testing it end to end.
 */
export function modelNameForPurpose(
  _purpose?: SimplePurposeId | string
): string {
  return 'deeprouter-auto'
}

export type IntegrationLanguage =
  | 'claude-code'
  | 'opencode'
  | 'curl'
  | 'python'
  | 'node'

export type SnippetInput = {
  baseUrl: string
  model: string
  /** Real key, or undefined → a copy-and-replace placeholder is used. */
  apiKey?: string | null
}

/**
 * Builds copy-paste-ready chat-completions snippets. When no key is supplied
 * we emit a clearly-fake placeholder so a user who opened the guide from the
 * page header (rather than a specific key) still gets runnable shape and
 * knows exactly what to swap in.
 */
export function buildIntegrationSnippets({
  baseUrl,
  model,
  apiKey,
}: SnippetInput): Record<IntegrationLanguage, string> {
  const key = apiKey || API_KEY_PLACEHOLDER
  // Claude Code wants the gateway origin WITHOUT /v1 — its SDK appends
  // /v1/messages itself (the gateway speaks the Anthropic protocol natively).
  const origin = baseUrl.replace(/\/v1\/?$/, '')

  const claudeCode = `# Run in your terminal, then start \`claude\` as usual.
# (Or put these in ~/.claude/settings.json under "env" to persist.)
export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export ANTHROPIC_MODEL="${model}"
export ANTHROPIC_SMALL_FAST_MODEL="${model}"
claude`

  const opencode = `// ~/.config/opencode/opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deeprouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepRouter",
      "options": {
        "baseURL": "${baseUrl}",
        "apiKey": "${key}"
      },
      "models": { "${model}": { "name": "DeepRouter Auto" } }
    }
  }
}
// Then run \`opencode\` → /models → DeepRouter → DeepRouter Auto`

  const curl = `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

  const python = `# pip install openai
from openai import OpenAI

client = OpenAI(
    api_key="${key}",
    base_url="${baseUrl}",
)

resp = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`

  const node = `// npm install openai
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${key}",
  baseURL: "${baseUrl}",
});

const resp = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(resp.choices[0].message.content);`

  return { 'claude-code': claudeCode, opencode, curl, python, node }
}
