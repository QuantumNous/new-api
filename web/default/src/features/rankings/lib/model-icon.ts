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
// Maps a model name to a @lobehub/icons component name for getLobeIcon().
// Rankings rows often lack a backend vendor_icon (vendor shows as
// "unknown"), which used to render a "?" placeholder — so the icon is
// inferred from the model name prefix instead. Unknown prefixes fall back
// to getLobeIcon's letter avatar (never "?") by passing the model name.

const MODEL_ICON_RULES: Array<[RegExp, string]> = [
  [/claude|anthropic/i, 'Claude.Color'],
  [/gpt|o[134](-|$)|dall-e|codex|openai/i, 'OpenAI'],
  [/gemini|imagen|veo|palm/i, 'Gemini.Color'],
  [/glm|zhipu/i, 'ChatGLM.Color'],
  [/deepseek/i, 'DeepSeek.Color'],
  [/qwen|qwq/i, 'Qwen.Color'],
  [/kimi|moonshot/i, 'Kimi.Color'],
  [/grok|xai/i, 'Grok'],
  [/llama|meta/i, 'Meta.Color'],
  [/mistral|mixtral/i, 'Mistral.Color'],
  [/doubao|seedance|seedream/i, 'Doubao.Color'],
  [/minimax|abab/i, 'Minimax.Color'],
]

/**
 * Resolve the icon identifier for a leaderboard row. Prefers the backend
 * vendor_icon when present; otherwise infers from the model name.
 */
export function modelIconName(
  modelName: string,
  vendorIcon?: string
): string {
  if (vendorIcon && vendorIcon.trim()) return vendorIcon
  for (const [pattern, icon] of MODEL_ICON_RULES) {
    if (pattern.test(modelName)) return icon
  }
  return modelName
}
