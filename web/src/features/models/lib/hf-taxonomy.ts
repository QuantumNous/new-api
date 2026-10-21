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
 * Hugging Face pipeline_tag taxonomy (offline reference)
 * ============================================================================
 *
 * Snapshot of https://huggingface.co/models pipeline categories, kept LOCAL so
 * model inference works without any network round-trip. The full HF vocabulary
 * is ~40 slugs partitioned into 6 super-groups; we keep every slug the API
 * gateway might realistically encounter and skip domain-specific ones (RL,
 * graph-ml, robotics, biology) that don't ship as inference-endpoint models.
 *
 * When HF publishes new pipeline_tag values (roughly once a year), the plan is
 * to add a "Sync from Hugging Face" admin button that fetches the taxonomy JSON
 * and updates this file — until then, curate manually.
 *
 * The i18n keys returned by `getGroupLabelKey` / `getPipelineTagLabelKey` are
 * intentionally English source strings (matches the i18next contract used
 * everywhere else in this codebase). Translations live in the locale JSON.
 */

// ---------------------------------------------------------------------------
// Group definitions — mirror HF's UI groupings 1:1
// ---------------------------------------------------------------------------

export type HFGroup =
  | 'multimodal'
  | 'vision'
  | 'nlp'
  | 'audio'
  | 'tabular'
  | 'other'

export const HF_GROUP_ORDER: HFGroup[] = [
  'multimodal',
  'vision',
  'nlp',
  'audio',
  'tabular',
  'other',
]

const HF_GROUP_LABEL_KEYS: Record<HFGroup, string> = {
  multimodal: 'Multimodal',
  vision: 'Computer Vision',
  nlp: 'Natural Language Processing',
  audio: 'Audio',
  tabular: 'Tabular',
  other: 'Other',
}

export function getGroupLabelKey(group: HFGroup): string {
  return HF_GROUP_LABEL_KEYS[group]
}

// ---------------------------------------------------------------------------
// Pipeline tags — the union of every slug we'll assign to a model
// ---------------------------------------------------------------------------
//
// Naming: matches HF exactly (kebab-case). Do NOT introduce project-local
// variants ("chat-completion") because the whole point of using HF's
// vocabulary is stable cross-project semantics.

export type HFPipelineTag =
  // Multimodal
  | 'image-text-to-text' // GPT-4o-style chat with image input
  | 'video-text-to-text' // GPT-4o with video input
  | 'visual-question-answering'
  | 'document-question-answering'
  | 'any-to-any'
  // Computer Vision
  | 'text-to-image' // Flux, SDXL, DALL-E
  | 'image-to-image' // inpainting, upscaling
  | 'text-to-video' // Sora, Veo
  | 'image-to-video' // seedance-i2v, Wan i2v
  | 'video-to-video'
  | 'image-to-text' // OCR, captioning
  | 'image-classification'
  // NLP
  | 'text-generation' // the "chat" default
  | 'text2text-generation'
  | 'translation'
  | 'summarization'
  | 'feature-extraction' // embeddings
  | 'sentence-similarity'
  | 'text-ranking' // reranker
  | 'question-answering'
  | 'fill-mask'
  | 'token-classification'
  // Audio
  | 'text-to-speech'
  | 'automatic-speech-recognition' // whisper, ASR
  | 'audio-to-audio'
  | 'text-to-audio'
  | 'audio-classification'
  // Tabular / other
  | 'tabular-classification'
  | 'time-series-forecasting'
  | 'other'

/**
 * Assign each pipeline_tag to its HF group. Used by the UI to render category
 * headings and by the suggestion panel to show a colour-coded chip.
 */
export const HF_PIPELINE_TAG_GROUPS: Record<HFPipelineTag, HFGroup> = {
  // Multimodal
  'image-text-to-text': 'multimodal',
  'video-text-to-text': 'multimodal',
  'visual-question-answering': 'multimodal',
  'document-question-answering': 'multimodal',
  'any-to-any': 'multimodal',
  // Vision
  'text-to-image': 'vision',
  'image-to-image': 'vision',
  'text-to-video': 'vision',
  'image-to-video': 'vision',
  'video-to-video': 'vision',
  'image-to-text': 'vision',
  'image-classification': 'vision',
  // NLP
  'text-generation': 'nlp',
  'text2text-generation': 'nlp',
  translation: 'nlp',
  summarization: 'nlp',
  'feature-extraction': 'nlp',
  'sentence-similarity': 'nlp',
  'text-ranking': 'nlp',
  'question-answering': 'nlp',
  'fill-mask': 'nlp',
  'token-classification': 'nlp',
  // Audio
  'text-to-speech': 'audio',
  'automatic-speech-recognition': 'audio',
  'audio-to-audio': 'audio',
  'text-to-audio': 'audio',
  'audio-classification': 'audio',
  // Tabular / other
  'tabular-classification': 'tabular',
  'time-series-forecasting': 'tabular',
  other: 'other',
}

/**
 * i18n source-string keys for each pipeline_tag. Kept as English HF slug
 * spellings so `t('text-to-image')` reads reasonably even without translation.
 * Locale JSON overrides these to natural-language names.
 */
const HF_PIPELINE_TAG_LABEL_KEYS: Record<HFPipelineTag, string> = {
  'image-text-to-text': 'Image + Text → Text',
  'video-text-to-text': 'Video + Text → Text',
  'visual-question-answering': 'Visual Question Answering',
  'document-question-answering': 'Document Question Answering',
  'any-to-any': 'Any-to-Any',
  'text-to-image': 'Text → Image',
  'image-to-image': 'Image → Image',
  'text-to-video': 'Text → Video',
  'image-to-video': 'Image → Video',
  'video-to-video': 'Video → Video',
  'image-to-text': 'Image → Text',
  'image-classification': 'Image Classification',
  'text-generation': 'Text Generation',
  'text2text-generation': 'Text-to-Text',
  translation: 'Translation',
  summarization: 'Summarization',
  'feature-extraction': 'Feature Extraction',
  'sentence-similarity': 'Sentence Similarity',
  'text-ranking': 'Text Ranking',
  'question-answering': 'Question Answering',
  'fill-mask': 'Fill Mask',
  'token-classification': 'Token Classification',
  'text-to-speech': 'Text-to-Speech',
  'automatic-speech-recognition': 'Automatic Speech Recognition',
  'audio-to-audio': 'Audio-to-Audio',
  'text-to-audio': 'Text-to-Audio',
  'audio-classification': 'Audio Classification',
  'tabular-classification': 'Tabular Classification',
  'time-series-forecasting': 'Time Series Forecasting',
  other: 'Other',
}

export function getPipelineTagLabelKey(tag: HFPipelineTag): string {
  return HF_PIPELINE_TAG_LABEL_KEYS[tag]
}

/**
 * Every HF pipeline_tag maps to a subset of the legacy capability tags used
 * elsewhere in the drawer (chat / vision / image / video / audio / embedding
 * / code / reasoning). This is the ONE PLACE we translate between the two
 * vocabularies so the UI can pull both a rich pipeline_tag label AND drop
 * legacy tags into the existing tag chip list.
 *
 * Notes:
 * - `text-generation` intentionally maps to `chat` because that's how every
 *   consumer already refers to it.
 * - `reasoning`/`code` are NOT HF pipeline_tags — they come from name-based
 *   inference separately.
 */
export const HF_TAG_TO_LEGACY_TAGS: Record<HFPipelineTag, readonly string[]> = {
  'image-text-to-text': ['chat', 'vision'],
  'video-text-to-text': ['chat', 'vision', 'video'],
  'visual-question-answering': ['chat', 'vision'],
  'document-question-answering': ['chat', 'vision'],
  'any-to-any': ['chat', 'vision', 'audio'],
  'text-to-image': ['image'],
  'image-to-image': ['image', 'vision'],
  'text-to-video': ['video'],
  'image-to-video': ['video', 'vision'],
  'video-to-video': ['video'],
  'image-to-text': ['vision', 'chat'],
  'image-classification': ['vision'],
  'text-generation': ['chat'],
  'text2text-generation': ['chat'],
  translation: ['chat'],
  summarization: ['chat'],
  'feature-extraction': ['embedding'],
  'sentence-similarity': ['embedding'],
  'text-ranking': ['embedding'],
  'question-answering': ['chat'],
  'fill-mask': ['chat'],
  'token-classification': ['chat'],
  'text-to-speech': ['audio'],
  'automatic-speech-recognition': ['audio'],
  'audio-to-audio': ['audio'],
  'text-to-audio': ['audio'],
  'audio-classification': ['audio'],
  'tabular-classification': [],
  'time-series-forecasting': [],
  other: [],
}

export function legacyTagsForPipelineTag(tag: HFPipelineTag): string[] {
  return [...HF_TAG_TO_LEGACY_TAGS[tag]]
}
