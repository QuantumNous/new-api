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
import type { ModelAccessModel } from '../types'

export type ModelBrand = {
  /** Display name, or null when the model cannot be placed. */
  name: string | null
  /** `@lobehub/icons` key, or null when no icon fits. */
  icon: string | null
}

/**
 * Name patterns → brand. Every icon key here is verified to exist in
 * `@lobehub/icons`; an unknown key would render as a letter tile, which is
 * still better than a "?" but worth avoiding.
 *
 * Order matters: `seedance`/`jimeng` must be matched before the generic video
 * families, and `sora`/`dall-e` belong to OpenAI despite being media models.
 */
const BRAND_PATTERNS: Array<[RegExp, string, string]> = [
  [/(^|\/)anthropic\//i, 'Anthropic', 'Claude'],
  [/(^|\/)openai\//i, 'OpenAI', 'OpenAI'],
  [/(^|\/)google\//i, 'Google', 'Gemini'],
  [/(^|\/)bytedance\//i, 'ByteDance', 'ByteDance'],
  [/claude/i, 'Anthropic', 'Claude'],
  [/gemini|gemma|imagen|veo|palm|nano-banana/i, 'Google', 'Gemini'],
  [
    /^gpt|^o[1-4](?:$|[-_.])|davinci|babbage|whisper|dall.?e|sora|^omni/i,
    'OpenAI',
    'OpenAI',
  ],
  [/grok/i, 'xAI', 'Grok'],
  [/seedance|jimeng|doubao|seed-?\d|seedream/i, 'ByteDance', 'ByteDance'],
  [/deepseek/i, 'DeepSeek', 'DeepSeek'],
  [/qwen|qwq|qvq|wan(?:$|[-_.])/i, 'Qwen', 'Qwen'],
  [/kimi|moonshot/i, 'Moonshot AI', 'Moonshot'],
  [/abab|minimax|hailuo/i, 'MiniMax', 'Minimax'],
  [/glm|chatglm|cogview|cogvideo/i, 'Zhipu AI', 'Zhipu'],
  [/hunyuan/i, 'Tencent', 'Hunyuan'],
  [/ernie|wenxin/i, 'Baidu', 'Baidu'],
  [/llama|codellama/i, 'Meta', 'Meta'],
  [/mistral|mixtral|codestral|magistral|pixtral/i, 'Mistral AI', 'Mistral'],
  [/command|cohere|aya/i, 'Cohere', 'Cohere'],
  [/jina|rerank/i, 'Jina AI', 'Jina'],
  [/kling/i, 'Kuaishou', 'Kling'],
  [/runway/i, 'Runway', 'Runway'],
  [/luma|dream-machine/i, 'Luma AI', 'Luma'],
  [/suno/i, 'Suno', 'Suno'],
  [/midjourney|niji/i, 'Midjourney', 'Midjourney'],
  [/flux/i, 'Black Forest Labs', 'Flux'],
  [/^sd-|stable[-_]?diffusion|sdxl/i, 'Stability AI', 'Stability'],
]

function inferBrandFromName(modelId: string): ModelBrand {
  for (const [pattern, name, icon] of BRAND_PATTERNS) {
    if (pattern.test(modelId)) return { name, icon }
  }
  return { name: null, icon: null }
}

/**
 * Brand shown on a catalog card.
 *
 * Configured vendor metadata wins — an operator who labelled a channel must
 * not be second-guessed by a name pattern. Many deployments ship models with
 * no vendor row at all, though, and falling back to the model name is what
 * keeps those cards from reading "?" / "Unknown" across the board.
 */
export function resolveModelBrand(model: ModelAccessModel): ModelBrand {
  const configuredName = model.vendor?.name?.trim()
  const configuredIcon = model.vendor?.icon?.trim()
  if (configuredName) {
    return {
      name: configuredName,
      // A labelled vendor without an icon still gets one from the model name,
      // so the card keeps its visual anchor.
      icon: configuredIcon || inferBrandFromName(model.id).icon,
    }
  }
  return inferBrandFromName(model.id)
}
