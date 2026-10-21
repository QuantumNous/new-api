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
 * Pricing schema — the frontend-side mapping of `pricing_kind` → drawer
 * field set + display units. Mirrors constant/pricing.go on the backend;
 * every string constant here MUST match the backend enum exactly, because
 * it's persisted on `model_meta.pricing_kind`.
 *
 * Design intent: the drawer looks at the current pricing_kind (either
 * auto-inferred from pipeline_tag or explicitly picked by the admin) and
 * renders ONLY the fields that make sense for that kind. Video models see
 * `$/秒 × 分辨率倍率`, image models see `$/张`, whisper sees `$/分钟`, etc.
 */

import type { HFPipelineTag } from './hf-taxonomy'

// -----------------------------------------------------------------------------
// PricingKind — 1:1 with constant/pricing.go
// -----------------------------------------------------------------------------

export const PRICING_KINDS = [
  'chat',
  'multimodal-chat',
  'image-gen',
  'video-gen',
  'audio-in',
  'audio-out',
  'embedding',
] as const

export type PricingKind = (typeof PRICING_KINDS)[number]

/**
 * Normalize an incoming string into a valid PricingKind. Empty / unknown
 * values fall back to "chat" to match the backend's
 * constant.NormalizePricingKind.
 */
export function normalizePricingKind(kind: string | null | undefined): PricingKind {
  if (typeof kind !== 'string') return 'chat'
  return (PRICING_KINDS as readonly string[]).includes(kind)
    ? (kind as PricingKind)
    : 'chat'
}

// -----------------------------------------------------------------------------
// pipeline_tag → pricing_kind mapping
// -----------------------------------------------------------------------------
//
// Used to auto-populate the KindSelector when the admin types a model name.
// The admin can always override via the dropdown, so this is a best-guess
// starting point, not a hard rule.

export const PIPELINE_TAG_TO_KIND: Record<HFPipelineTag, PricingKind> = {
  // Multimodal
  'image-text-to-text': 'multimodal-chat',
  'video-text-to-text': 'multimodal-chat',
  'visual-question-answering': 'multimodal-chat',
  'document-question-answering': 'multimodal-chat',
  'any-to-any': 'multimodal-chat',
  // Vision
  'text-to-image': 'image-gen',
  'image-to-image': 'image-gen',
  'text-to-video': 'video-gen',
  'image-to-video': 'video-gen',
  'video-to-video': 'video-gen',
  'image-to-text': 'multimodal-chat',
  'image-classification': 'chat',
  // NLP
  'text-generation': 'chat',
  'text2text-generation': 'chat',
  translation: 'chat',
  summarization: 'chat',
  'feature-extraction': 'embedding',
  'sentence-similarity': 'embedding',
  'text-ranking': 'embedding',
  'question-answering': 'chat',
  'fill-mask': 'chat',
  'token-classification': 'chat',
  // Audio
  'text-to-speech': 'audio-out',
  'automatic-speech-recognition': 'audio-in',
  'audio-to-audio': 'audio-out',
  'text-to-audio': 'audio-out',
  'audio-classification': 'audio-in',
  // Tabular / other → default to chat
  'tabular-classification': 'chat',
  'time-series-forecasting': 'chat',
  other: 'chat',
}

// -----------------------------------------------------------------------------
// Schema field descriptor — used to render the drawer's per-kind field set
// -----------------------------------------------------------------------------

export type PricingSchemaField =
  // Legacy token-based fields (from Chat schema)
  | 'ratio'
  | 'completionRatio'
  | 'cacheRatio'
  | 'imageRatio' // multimodal-chat only
  | 'audioRatio' // multimodal-chat only
  | 'audioCompletionRatio' // multimodal-chat only
  // Structured pricing fields
  | 'imagePricePerImage'
  | 'imageQualityMultipliers'
  | 'imageSizeMultipliers'
  | 'videoPricePerSecond'
  | 'videoResolutionMultipliers'
  | 'videoHasAudioMultiplier'
  | 'audioInPricePerMinute'
  | 'audioInMinBillMinutes'
  | 'audioOutPricePerMillionChars'
  | 'audioOutVoiceMultipliers'

/**
 * Field membership per schema. Any field NOT in the returned array is
 * hidden by the drawer. The order in each list drives the vertical
 * rendering order (basic first, multipliers after).
 */
export function getSchemaFields(kind: PricingKind): PricingSchemaField[] {
  switch (kind) {
    case 'chat':
      return ['ratio', 'completionRatio', 'cacheRatio']
    case 'multimodal-chat':
      return [
        'ratio',
        'completionRatio',
        'cacheRatio',
        'imageRatio',
        'audioRatio',
        'audioCompletionRatio',
      ]
    case 'image-gen':
      return [
        'imagePricePerImage',
        'imageQualityMultipliers',
        'imageSizeMultipliers',
      ]
    case 'video-gen':
      return [
        'videoPricePerSecond',
        'videoResolutionMultipliers',
        'videoHasAudioMultiplier',
      ]
    case 'audio-in':
      return ['audioInPricePerMinute', 'audioInMinBillMinutes']
    case 'audio-out':
      return ['audioOutPricePerMillionChars', 'audioOutVoiceMultipliers']
    case 'embedding':
      return ['ratio']
  }
}

// -----------------------------------------------------------------------------
// Unit labels — displayed next to price inputs so admins know what unit they're
// entering. Kept as English source strings; locale JSON provides the display.
// -----------------------------------------------------------------------------

export function getPriceUnitKey(kind: PricingKind): string {
  switch (kind) {
    case 'chat':
    case 'multimodal-chat':
    case 'embedding':
      return 'per 1M tokens'
    case 'image-gen':
      return 'per image'
    case 'video-gen':
      return 'per second'
    case 'audio-in':
      return 'per minute'
    case 'audio-out':
      return 'per 1M characters'
  }
}

/**
 * Human-friendly label for the schema itself (used in the KindSelector
 * dropdown). Not the same as the pipeline_tag label — this is admin-facing
 * language about "how billing works" rather than "what the model does".
 */
export function getKindLabelKey(kind: PricingKind): string {
  switch (kind) {
    case 'chat':
      return 'Chat (per-token)'
    case 'multimodal-chat':
      return 'Multimodal chat (per-token, with image/audio input)'
    case 'image-gen':
      return 'Image generation (per-image)'
    case 'video-gen':
      return 'Video generation (per-second)'
    case 'audio-in':
      return 'Speech recognition (per-minute)'
    case 'audio-out':
      return 'Speech synthesis (per-1M-characters)'
    case 'embedding':
      return 'Embedding / Reranking (per-token, input only)'
  }
}

// -----------------------------------------------------------------------------
// pipeline_tag → Model.model_type mapping
// -----------------------------------------------------------------------------
//
// `model_type` is a separate persisted field on the model row (independent of
// tags and pricing_kind) that drives table filtering. Historically it had to
// be picked manually by the admin; nothing auto-derived it. This mapping lets
// the drawer infer a sensible default when the admin types a new model name,
// so `doubao-seedream-5.0-lite` doesn't land on the default `text` while its
// suggestion chip screams "image".
//
// Kept as a small function (not a Record<>) so unknown HFPipelineTag values
// fall through to `text` explicitly rather than surfacing `undefined`.

export type ModelTypeCode =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'embedding'
  | 'file'

export function pipelineTagToModelType(tag: HFPipelineTag): ModelTypeCode {
  switch (tag) {
    // Vision generation → image or video
    case 'text-to-image':
    case 'image-to-image':
      return 'image'
    case 'text-to-video':
    case 'image-to-video':
    case 'video-to-video':
      return 'video'
    // Vision analysis → image (bytes are image; classification/OCR)
    case 'image-classification':
    case 'image-to-text':
      return 'image'
    // Audio in/out
    case 'text-to-speech':
    case 'automatic-speech-recognition':
    case 'audio-to-audio':
    case 'text-to-audio':
    case 'audio-classification':
      return 'audio'
    // Embedding family
    case 'feature-extraction':
    case 'sentence-similarity':
    case 'text-ranking':
      return 'embedding'
    // Multimodal chat / VQA — the primary output is text, so keep as text
    // even though the model consumes images. Admins can override to `image`
    // if they filter their table on capability rather than output modality.
    case 'image-text-to-text':
    case 'video-text-to-text':
    case 'visual-question-answering':
    case 'document-question-answering':
    case 'any-to-any':
    case 'text-generation':
    case 'text2text-generation':
    case 'translation':
    case 'summarization':
    case 'question-answering':
    case 'fill-mask':
    case 'token-classification':
    case 'tabular-classification':
    case 'time-series-forecasting':
    case 'other':
      return 'text'
  }
}

// -----------------------------------------------------------------------------
// model_type → pricing_kind mapping
// -----------------------------------------------------------------------------
//
// When the admin manually changes model_type in the drawer (or when the
// system infers it from pipeline_tag on new-model create), the drawer's
// pricing configuration should switch to the corresponding billing mode.
// This function returns a *default* pricing_kind for each model_type; the
// admin can still override via the KindSelector dropdown for edge cases
// (e.g. an audio model that's actually TTS instead of ASR).
//
// Two model_types can map to multiple valid pricing_kinds:
//
//   - text → chat (default) or multimodal-chat (if the model accepts image/
//     audio input tokens; admin must manually pick this variant)
//   - audio → audio-in (default, ASR family) or audio-out (TTS family;
//     admin must manually pick this variant)
//
// For image / video / embedding / file the mapping is unambiguous.

export function modelTypeToPricingKind(modelType: ModelTypeCode): PricingKind {
  switch (modelType) {
    case 'image':
      return 'image-gen'
    case 'video':
      return 'video-gen'
    case 'audio':
      // Most audio models this platform routes are ASR (whisper family).
      // TTS admins can manually flip to audio-out via KindSelector.
      return 'audio-in'
    case 'embedding':
      return 'embedding'
    case 'text':
    case 'file':
    default:
      return 'chat'
  }
}

/**
 * Compatible pricing_kinds for a given model_type. Used by the drawer to
 * present only the kinds that make sense in the KindSelector dropdown after
 * the admin has picked a model_type — no need to show `image-gen` when the
 * type is `audio`, for example. Order matches admin expectation (most
 * common variant first).
 */
export function pricingKindsForModelType(modelType: ModelTypeCode): PricingKind[] {
  switch (modelType) {
    case 'text':
    case 'file':
      // text has both mono-modal (chat) and multi-modal variants
      return ['chat', 'multimodal-chat']
    case 'image':
      return ['image-gen']
    case 'video':
      return ['video-gen']
    case 'audio':
      return ['audio-in', 'audio-out']
    case 'embedding':
      return ['embedding']
  }
}
