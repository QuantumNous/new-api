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
 * Model tag & context inference from a model name
 * ============================================================================
 *
 * Given only a model name (e.g. "deepseek-r1-pro", "sora-turbo",
 * "qwen-vl-72b"), produce a best-effort classification aligned with the
 * Hugging Face `pipeline_tag` vocabulary plus the legacy capability tags
 * (`chat`, `vision`, `image`, `video`, `audio`, `embedding`, `code`,
 * `reasoning`) that already ship with the drawer's Tag Presets.
 *
 * Lookup strategy — first hit wins:
 *
 *   1. `KNOWN_MODELS` registry — exact prefix match for well-known families
 *      (gpt-4o, claude-4-opus, doubao-seedance, deepseek-r1, ...). This is
 *      the most reliable path because it encodes real-world semantics HF's
 *      slug alone can't capture (e.g. gpt-4o being multi-modal without an
 *      `-omni` suffix).
 *
 *   2. Regex pattern buckets — pipeline_tag inferred by name shape
 *      (`/vl(?:[-_]|$)/`, `/seedance/`, `/whisper/`, ...). Covers new models
 *      the registry doesn't know about yet.
 *
 *   3. Fallback — `text-generation` with the `chat` legacy tag. Same behavior
 *      as HF: unknown text models are text-generation until proven otherwise.
 *
 * All lookups run OFFLINE. To keep the vocabulary current, an admin can (in
 * a future release) trigger a "Sync from Hugging Face" refresh that
 * regenerates KNOWN_MODELS from the HF taxonomy JSON.
 */

import {
  type HFPipelineTag,
  HF_PIPELINE_TAG_GROUPS,
  type HFGroup,
  legacyTagsForPipelineTag,
} from './hf-taxonomy'
import { lookupKnownModel } from './known-model-registry'

// ---------------------------------------------------------------------------
// Capability regex patterns
//
// Ordering rule: put the more specific / less ambiguous patterns first —
// `qwen-r1` will match reasoning; a plain `qwen3` will fall through to chat.
// Keep pattern lists small and observable; add cases when we see real-world
// model names that miss.
// ---------------------------------------------------------------------------

const REASONING_PATTERNS: RegExp[] = [
  /^o[1-4](?:[-:_].+)?$/i, // openai o1/o3/o4 family
  /reasoning/i,
  /thinking/i, // gemini thinking, doubao thinking
  /deep[-_]?think/i,
  /qwq/i, // qwen QwQ reasoning
  /deepseek[-_]?r\d/i, // deepseek-r1, r2, ...
  /grok.*-(?:thinking|reasoning)/i,
]

const VISION_PATTERNS: RegExp[] = [
  /vision/i,
  /vl(?:[-_]|$)/i, // qwen-vl, glm-4v (see below), doubao-vl
  /-4v(?:[-_]|$)/i, // glm-4v
  /multimodal/i,
  /-omni/i, // gpt-omni style
  /-4o(?:[-_]|$)/i, // gpt-4o family is multi-modal by default
  /gpt-5/i, // gpt-5 family carries vision
]

// AUDIO_PATTERNS used to live here; it was folded into individual audio
// checks inside `inferPipelineTagByRegex` so each sub-category
// (text-to-speech, automatic-speech-recognition, audio-to-audio, ...)
// can be distinguished. Keep this comment as a signpost for anyone
// reintroducing an "any audio" test.


// Video generation / understanding — order matters, "sora" before generic
// text-video substrings.
const VIDEO_PATTERNS: RegExp[] = [
  /sora/i,
  /veo/i,
  /kling/i,
  /pika/i,
  /wan(?:2\.\d)?[-_]?i2v/i, // Wan 2.x image-to-video
  /wan[-_]?t?2?v/i,
  /seedance/i, // volcengine doubao-seedance
  /-i2v(?:[-_]|$)/i,
  /-t2v(?:[-_]|$)/i,
  /video/i, // catch-all last
]

const IMAGE_GEN_PATTERNS: RegExp[] = [
  /seedream/i, // doubao-seedream
  /flux/i,
  /dall[-_]?e/i,
  /-imagegen/i,
  /-image(?:[-_]|$)/i,
  /^gpt-image/i,
  /midjourney/i,
  /stable-diffusion/i,
  /sd-\d/i,
]

const EMBEDDING_PATTERNS: RegExp[] = [
  /^text-embedding/i,
  /-embedding(?:[-_]|$)/i,
  /^embed[-_]/i,
  /^bge[-_]/i,
  /jina.*embed/i,
]

const CODE_PATTERNS: RegExp[] = [/-coder(?:[-_]|$)/i, /code[-_]?llama/i, /codestral/i]

const FUNCTION_CALLING_HINT_PATTERNS: RegExp[] = [
  /gpt-4/i,
  /gpt-5/i,
  /claude-3/i,
  /claude-4/i,
  /gemini-1\.5/i,
  /gemini-2/i,
  /qwen-max/i,
  /qwen3/i,
  /deepseek-v[23]/i,
]

// ---------------------------------------------------------------------------
// Context length heuristic — mirrors the pricing library's rules so admin
// values match what the pricing page would infer for the same model.
// ---------------------------------------------------------------------------

const CONTEXT_RULES: Array<{ pattern: RegExp; context: number }> = [
  // Explicit context markers win first — an admin adds -1m or -128k to opt in.
  { pattern: /1m(?:[-_]|$)|-long(?:[-_]|$)/i, context: 1_000_000 },
  { pattern: /200k/i, context: 200_000 },
  { pattern: /128k/i, context: 128_000 },
  { pattern: /64k/i, context: 65_536 },
  { pattern: /32k/i, context: 32_768 },
  { pattern: /16k/i, context: 16_384 },
  { pattern: /8k/i, context: 8_192 },
  // Specific family+tier wins before broader family default. claude-4-opus
  // and gemini-2 announce 1M windows; plain claude-3/4 stays at 200k.
  { pattern: /claude-(?:4[-_]?opus|opus[-_]?4|4[-_]?sonnet)/i, context: 1_000_000 },
  { pattern: /gemini-2|gemini-1\.5|gemini.*pro|gemini.*flash/i, context: 1_000_000 },
  { pattern: /claude-3|claude-4|claude-3-5|claude-3\.5/i, context: 200_000 },
  { pattern: /gpt-3\.5|claude-2/i, context: 16_384 },
  { pattern: /gpt-4o|gpt-4\.1|gpt-5|o[134][-_]|o[134]$/i, context: 128_000 },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Result of inferring a single model's tag and context defaults.
 *
 * `tags` is a deduplicated array of legacy capability tags; every value MUST
 * be one of the TAG_PRESETS "Model Capabilities" tags so the suggestion-pill
 * UI can render them with the same styling.
 *
 * `pipelineTag` is the primary Hugging Face classification for the model —
 * richer semantics than the legacy tags (e.g. `text-to-image` vs bare `image`).
 * Consumers can render this alongside the legacy tag chips.
 *
 * `group` is the HF super-group (`multimodal`, `vision`, `nlp`, ...) — used
 * for colour-coding in the UI.
 *
 * `context` is `undefined` when no rule matched — that signals to the UI
 * to leave the context_length field alone.
 *
 * `source` records which lookup layer produced the result — useful for
 * telemetry and for tests to prove the intended path fired.
 */
export type InferredModelDefaults = {
  tags: string[]
  pipelineTag: HFPipelineTag
  group: HFGroup
  context?: number
  source: 'registry' | 'regex' | 'fallback'
}

// ---------------------------------------------------------------------------
// Regex-based pipeline_tag inference (fallback when registry misses)
// ---------------------------------------------------------------------------
//
// Order matters: check the most specific / least ambiguous slugs first.
// Every branch returns immediately so we don't accidentally reclassify a
// text-to-video model as text-generation because "text" appears in the name.

function inferPipelineTagByRegex(name: string): HFPipelineTag | undefined {
  const nameMatches = (patterns: RegExp[]) =>
    patterns.some((re) => re.test(name))

  // 1) Video generation — most specific media modality.
  if (
    nameMatches([
      /-i2v(?:[-_]|$)/i,
      /wan(?:2\.\d)?[-_]?i2v/i,
      /image[-_]?to[-_]?video/i,
    ])
  ) {
    return 'image-to-video'
  }
  if (nameMatches([...VIDEO_PATTERNS, /-t2v(?:[-_]|$)/i])) {
    return 'text-to-video'
  }

  // 2) Image generation — cover explicit "text-to-image" and image-only names.
  if (nameMatches(IMAGE_GEN_PATTERNS)) {
    return 'text-to-image'
  }

  // 3) Audio families.
  if (nameMatches([/tts/i, /text[-_]?to[-_]?speech/i, /-speech(?:[-_]|$)/i])) {
    return 'text-to-speech'
  }
  if (
    nameMatches([
      /whisper/i,
      /-asr(?:[-_]|$)/i,
      /automatic[-_]?speech/i,
      /transcribe/i,
    ])
  ) {
    return 'automatic-speech-recognition'
  }
  if (nameMatches([/-realtime/i, /voxtral/i, /audio[-_]?to[-_]?audio/i])) {
    return 'audio-to-audio'
  }
  if (nameMatches([/audio/i, /voice/i])) {
    return 'text-to-audio'
  }

  // 4) Embedding / reranking.
  if (nameMatches([/-reranker(?:[-_]|$)/i, /-rerank(?:[-_]|$)/i, /reranker/i])) {
    return 'text-ranking'
  }
  if (nameMatches(EMBEDDING_PATTERNS)) {
    return 'feature-extraction'
  }

  // 5) Vision + text (chat-with-images). Only classify as multimodal if the
  //    name mentions a vision marker — plain chat models fall through to NLP.
  if (nameMatches(VISION_PATTERNS)) {
    return 'image-text-to-text'
  }

  // 6) NLP fallback — no HF-specific slug fired. Distinguish nothing; caller
  //    returns undefined so the top-level function can emit the final
  //    fallback with `source: 'fallback'`.
  return undefined
}

/**
 * Infer the Hugging Face pipeline_tag for a raw model name.
 *
 * Layered lookup:
 *   1. Exact-prefix registry match (KNOWN_MODELS)
 *   2. Regex-based classification (this file's pattern buckets)
 *   3. Fallback: text-generation
 *
 * See `InferredModelDefaults.source` for which path fired.
 */
export function inferPipelineTag(name: string): {
  pipelineTag: HFPipelineTag
  source: 'registry' | 'regex' | 'fallback'
} {
  const trimmed = name.trim()
  if (!trimmed) return { pipelineTag: 'other', source: 'fallback' }

  const registryHit = lookupKnownModel(trimmed)
  if (registryHit) {
    return { pipelineTag: registryHit.pipelineTag, source: 'registry' }
  }

  const regexHit = inferPipelineTagByRegex(trimmed)
  if (regexHit) return { pipelineTag: regexHit, source: 'regex' }

  return { pipelineTag: 'text-generation', source: 'fallback' }
}

/**
 * Infer capability tags from a raw model name. The function never returns
 * `undefined`; if nothing matches, `tags` is `[]` — the caller decides
 * whether to fall back to `chat` or leave the field empty.
 *
 * This is kept as a thin adapter that ultimately consults inferPipelineTag
 * plus a few name-based capability additions (reasoning / code) that HF's
 * pipeline_tag alone can't express.
 */
export function inferTagsFromModelName(name: string): string[] {
  const defaults = inferModelDefaults(name)
  return defaults.tags
}

/**
 * Infer a plausible context window from a raw model name. Returns `undefined`
 * when no rule matched — the drawer treats that as "leave field alone".
 *
 * The registry entry's `context` (if present) wins; otherwise the regex
 * CONTEXT_RULES fire. This mirrors the pricing library's buckets so the two
 * never disagree on the same model name.
 */
export function inferContextFromModelName(name: string): number | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined

  const registryHit = lookupKnownModel(trimmed)
  if (registryHit?.context) return registryHit.context

  const lower = trimmed.toLowerCase()
  for (const { pattern, context } of CONTEXT_RULES) {
    if (pattern.test(lower)) return context
  }
  return undefined
}

/**
 * One-shot helper the drawer uses to compute all defaults it needs.
 *
 * Combines registry + regex + HF taxonomy → a single result that carries:
 * - the HF pipeline_tag (rich label)
 * - the HF group (for UI colour)
 * - a deduplicated list of legacy capability tags (chat/vision/image/...)
 *   derived from the pipeline_tag PLUS any registry extras (reasoning/code)
 *   PLUS name-based extras (function-calling hint)
 * - a context-length guess when we have a strong signal
 * - a `source` marker so callers/tests can tell how the answer was reached
 */
export function inferModelDefaults(name: string): InferredModelDefaults {
  const trimmed = name.trim()

  const { pipelineTag, source } = inferPipelineTag(trimmed)
  const group = HF_PIPELINE_TAG_GROUPS[pipelineTag]

  const legacyTags = new Set<string>(legacyTagsForPipelineTag(pipelineTag))

  const registryHit = lookupKnownModel(trimmed)
  if (registryHit?.extraTags) {
    for (const t of registryHit.extraTags) legacyTags.add(t)
  }

  // Name-based reasoning / code hints when the registry didn't already tell us.
  const matchesAny = (patterns: RegExp[]) =>
    trimmed.length > 0 && patterns.some((re) => re.test(trimmed))
  if (matchesAny(REASONING_PATTERNS)) legacyTags.add('reasoning')
  if (matchesAny(CODE_PATTERNS)) legacyTags.add('code')

  // Function-calling hint for modern chat models when the registry didn't
  // pin it and the model isn't a reasoning / media-generation one.
  const nlp = group === 'nlp' || group === 'multimodal'
  if (
    nlp &&
    !legacyTags.has('reasoning') &&
    !legacyTags.has('function-calling') &&
    matchesAny(FUNCTION_CALLING_HINT_PATTERNS)
  ) {
    legacyTags.add('function-calling')
    legacyTags.add('tools')
  }

  return {
    tags: [...legacyTags],
    pipelineTag,
    group,
    context: inferContextFromModelName(trimmed),
    source,
  }
}

