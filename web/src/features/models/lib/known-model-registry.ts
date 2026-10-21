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
 * ============================================================================
 * Known model registry — exact-name → HF pipeline_tag mapping
 * ============================================================================
 *
 * Manually curated table of every well-known model this gateway routes to,
 * paired with its Hugging Face pipeline_tag. Consulted BEFORE the regex
 * fallback so gpt-4o gets `image-text-to-text` even if the name doesn't have
 * an `-omni` suffix, and doubao-seedance-2-0 gets `image-to-video` even
 * though "-i2v" isn't in the name.
 *
 * Entries are matched against the model name using `prefixMatch(name, key)`:
 * a prefix match is enough (so `gpt-4o-2026-08-06` still hits `gpt-4o`).
 * That's important because providers add date suffixes and size variants at
 * runtime — we don't want to list every single date.
 *
 * When adding an entry:
 * 1. Prefer the longest common prefix that uniquely identifies the family.
 * 2. If two families share a prefix, list the more specific one first — the
 *    lookup returns on first match.
 * 3. Keep the list grouped by provider for scanability, but the runtime
 *    matcher iterates in declaration order.
 */

import type { HFPipelineTag } from './hf-taxonomy'

export type KnownModelEntry = {
  /**
   * Model-name prefix (case-insensitive). Match wins if `nameLower.startsWith(prefix)`.
   */
  prefix: string
  pipelineTag: HFPipelineTag
  /**
   * Optional additional legacy tags (e.g. `reasoning`, `code`) that HF's
   * pipeline_tag doesn't capture. Merged with `HF_TAG_TO_LEGACY_TAGS[tag]`.
   */
  extraTags?: readonly string[]
  /**
   * Optional context-window override for models the regex heuristic mis-sizes.
   */
  context?: number
}

/**
 * The registry — order matters when prefixes could collide. Grouping by
 * provider is a documentation aid, not a lookup constraint.
 */
export const KNOWN_MODELS: KnownModelEntry[] = [
  // ---------------------- OpenAI ----------------------
  { prefix: 'gpt-5', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 400_000 },
  { prefix: 'gpt-4.1', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'gpt-4o-mini-realtime', pipelineTag: 'audio-to-audio', extraTags: ['chat', 'function-calling'] },
  { prefix: 'gpt-4o-realtime', pipelineTag: 'audio-to-audio', extraTags: ['chat', 'function-calling'] },
  { prefix: 'gpt-4o-transcribe', pipelineTag: 'automatic-speech-recognition' },
  { prefix: 'gpt-4o-mini-transcribe', pipelineTag: 'automatic-speech-recognition' },
  { prefix: 'gpt-4o-mini-tts', pipelineTag: 'text-to-speech' },
  { prefix: 'gpt-4o-mini', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 128_000 },
  { prefix: 'gpt-4o-audio', pipelineTag: 'audio-to-audio', extraTags: ['chat'] },
  { prefix: 'gpt-4o', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 128_000 },
  { prefix: 'gpt-image', pipelineTag: 'text-to-image' },
  { prefix: 'dall-e', pipelineTag: 'text-to-image' },
  { prefix: 'sora', pipelineTag: 'text-to-video' },
  { prefix: 'whisper', pipelineTag: 'automatic-speech-recognition' },
  { prefix: 'tts-1', pipelineTag: 'text-to-speech' },
  { prefix: 'text-embedding-3', pipelineTag: 'feature-extraction' },
  { prefix: 'text-embedding-ada', pipelineTag: 'feature-extraction' },
  { prefix: 'o4-mini', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 200_000 },
  { prefix: 'o3-mini', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 200_000 },
  { prefix: 'o3', pipelineTag: 'image-text-to-text', extraTags: ['reasoning'], context: 200_000 },
  { prefix: 'o1-mini', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 128_000 },
  { prefix: 'o1', pipelineTag: 'image-text-to-text', extraTags: ['reasoning'], context: 200_000 },
  { prefix: 'gpt-4-turbo', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 128_000 },
  { prefix: 'gpt-4-vision', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'gpt-4', pipelineTag: 'text-generation', extraTags: ['function-calling', 'tools'], context: 128_000 },
  { prefix: 'gpt-3.5', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 16_384 },

  // ---------------------- Anthropic ----------------------
  { prefix: 'claude-opus-4', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'claude-sonnet-4', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'claude-4-opus', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'claude-4-sonnet', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'claude-3-5-sonnet', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 200_000 },
  { prefix: 'claude-3.5-sonnet', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 200_000 },
  { prefix: 'claude-3-opus', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 200_000 },
  { prefix: 'claude-3-haiku', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 200_000 },
  { prefix: 'claude-3', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 200_000 },
  { prefix: 'claude-2', pipelineTag: 'text-generation', context: 100_000 },

  // ---------------------- Google ----------------------
  { prefix: 'gemini-2-flash-thinking', pipelineTag: 'image-text-to-text', extraTags: ['reasoning'], context: 1_000_000 },
  { prefix: 'gemini-2-flash', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'gemini-2-pro', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 2_000_000 },
  { prefix: 'gemini-2', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'gemini-1.5-pro', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 2_000_000 },
  { prefix: 'gemini-1.5-flash', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'gemini-1.5', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'tools'], context: 1_000_000 },
  { prefix: 'gemini-pro', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 32_768 },
  { prefix: 'imagen', pipelineTag: 'text-to-image' },
  { prefix: 'veo', pipelineTag: 'text-to-video' },

  // ---------------------- DeepSeek ----------------------
  { prefix: 'deepseek-r1', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 64_000 },
  { prefix: 'deepseek-v3', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'deepseek-v2', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'deepseek-coder', pipelineTag: 'text-generation', extraTags: ['code'], context: 128_000 },
  { prefix: 'deepseek-vl', pipelineTag: 'image-text-to-text', context: 8_192 },
  { prefix: 'deepseek-chat', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },

  // ---------------------- Qwen ----------------------
  { prefix: 'qwen3-omni', pipelineTag: 'any-to-any', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen3-vl', pipelineTag: 'image-text-to-text', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen3-coder', pipelineTag: 'text-generation', extraTags: ['code'], context: 128_000 },
  { prefix: 'qwen3-max', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen3', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen2.5-vl', pipelineTag: 'image-text-to-text', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen2.5-coder', pipelineTag: 'text-generation', extraTags: ['code'], context: 128_000 },
  { prefix: 'qwen2.5', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'qwen2-vl', pipelineTag: 'image-text-to-text', context: 32_768 },
  { prefix: 'qwen2', pipelineTag: 'text-generation', context: 128_000 },
  { prefix: 'qwen-vl', pipelineTag: 'image-text-to-text', context: 32_768 },
  { prefix: 'qwq', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 32_768 },

  // ---------------------- Volcengine / Doubao ----------------------
  { prefix: 'doubao-seedance', pipelineTag: 'text-to-video' },
  { prefix: 'doubao-seedream', pipelineTag: 'text-to-image' },
  { prefix: 'doubao-vision', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'doubao-1-5-thinking', pipelineTag: 'text-generation', extraTags: ['reasoning'], context: 128_000 },
  { prefix: 'doubao-1-5-pro', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 256_000 },
  { prefix: 'doubao-1-5', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'doubao-pro', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'doubao', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'seed-tts', pipelineTag: 'text-to-speech' },
  { prefix: 'voxtral', pipelineTag: 'audio-to-audio' },

  // ---------------------- MoonShot / GLM / MiniMax / Baichuan ----------------------
  { prefix: 'moonshot-v1-vision', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'moonshot-v1', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'kimi-k2', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'kimi', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'glm-4v', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'glm-4-plus', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'glm-4', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'minimax-m1', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 1_000_000 },
  { prefix: 'abab6', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 245_000 },
  { prefix: 'baichuan', pipelineTag: 'text-generation', context: 192_000 },

  // ---------------------- xAI / Meta / Mistral / Cohere ----------------------
  { prefix: 'grok-2-vision', pipelineTag: 'image-text-to-text', context: 32_768 },
  { prefix: 'grok-2', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'grok-3', pipelineTag: 'image-text-to-text', extraTags: ['function-calling', 'reasoning'], context: 128_000 },
  { prefix: 'llama-3.3', pipelineTag: 'text-generation', context: 128_000 },
  { prefix: 'llama-3.2-vision', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'llama-3.2', pipelineTag: 'text-generation', context: 128_000 },
  { prefix: 'llama-3.1', pipelineTag: 'text-generation', context: 128_000 },
  { prefix: 'llama-3', pipelineTag: 'text-generation', context: 8_192 },
  { prefix: 'mistral-large', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },
  { prefix: 'mistral', pipelineTag: 'text-generation', context: 32_768 },
  { prefix: 'codestral', pipelineTag: 'text-generation', extraTags: ['code'], context: 32_768 },
  { prefix: 'pixtral', pipelineTag: 'image-text-to-text', context: 128_000 },
  { prefix: 'command-r', pipelineTag: 'text-generation', extraTags: ['function-calling'], context: 128_000 },

  // ---------------------- Video / Image generation providers ----------------------
  { prefix: 'flux', pipelineTag: 'text-to-image' },
  { prefix: 'stable-diffusion', pipelineTag: 'text-to-image' },
  { prefix: 'sd-', pipelineTag: 'text-to-image' },
  { prefix: 'sdxl', pipelineTag: 'text-to-image' },
  { prefix: 'midjourney', pipelineTag: 'text-to-image' },
  { prefix: 'kling', pipelineTag: 'text-to-video' },
  { prefix: 'jimeng', pipelineTag: 'text-to-image' },
  { prefix: 'vidu', pipelineTag: 'text-to-video' },
  { prefix: 'wan2', pipelineTag: 'image-to-video' },
  { prefix: 'ideogram', pipelineTag: 'text-to-image' },
  { prefix: 'recraft', pipelineTag: 'text-to-image' },

  // ---------------------- Embedding / Reranker ----------------------
  { prefix: 'bge-reranker', pipelineTag: 'text-ranking' },
  { prefix: 'bge-', pipelineTag: 'feature-extraction' },
  { prefix: 'jina-reranker', pipelineTag: 'text-ranking' },
  { prefix: 'jina-embeddings', pipelineTag: 'feature-extraction' },
  { prefix: 'jina-clip', pipelineTag: 'feature-extraction' },
  { prefix: 'cohere-rerank', pipelineTag: 'text-ranking' },
  { prefix: 'cohere-embed', pipelineTag: 'feature-extraction' },
  { prefix: 'voyage-', pipelineTag: 'feature-extraction' },
]

/**
 * Look up a model in the registry. Returns the first entry whose prefix is a
 * prefix of the (lowercased) model name, or `undefined` for a miss.
 *
 * Prefix match, not substring — a name like `custom-gpt-4o-clone` should NOT
 * inherit gpt-4o's pipeline_tag, because the wrapper might change semantics
 * (e.g. it might strip vision). Users who want that mapping can add an
 * explicit registry entry.
 */
export function lookupKnownModel(name: string): KnownModelEntry | undefined {
  const lower = name.trim().toLowerCase()
  if (!lower) return undefined
  for (const entry of KNOWN_MODELS) {
    if (lower.startsWith(entry.prefix.toLowerCase())) {
      return entry
    }
  }
  return undefined
}
