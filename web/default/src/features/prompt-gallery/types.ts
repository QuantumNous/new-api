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
export type PromptLibraryAdminItem = {
  id: number
  slug: string
  category: string
  model: string
  prompt: string
  title_json: string
  summary_json: string
  tags_json: string
  output_json: string
  artifact_json: string
  source_json: string
  source_platform: string
  source_url: string
  captured_at: string
  enabled: boolean
  created_time: number
  updated_time: number
}

export type PromptGalleryListData = {
  page: number
  page_size: number
  total: number
  items: PromptLibraryAdminItem[] | null
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

// Form model: JSON columns flattened into editable fields
export type PromptGalleryFormData = {
  slug: string
  category: string
  model: string
  prompt: string
  titleEn: string
  summaryEn: string
  tags: string // comma separated
  imageUrl: string
  imageAlt: string
  sourceLabel: string
  sourcePlatform: string
  sourceUrl: string
  enabled: boolean
}

export const PROMPT_GALLERY_CATEGORIES = [
  'image',
  'video',
  'audio',
  'text',
  'agent',
] as const

// i18n keys for category labels, shared by the table filter and the dialog
export const PROMPT_GALLERY_CATEGORY_LABEL_KEYS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
  agent: 'Agent',
}

type JsonRecord = Record<string, unknown>

// Backend marshals absent optional JSON columns as the literal string "null";
// JSON.parse('null') succeeds and returns null, which would make property
// reads throw — coalesce to {} inside the try. Malformed JSON also yields {}.
const safeParseJson = (raw: string): unknown => {
  try {
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed ?? {}
  } catch {
    return {}
  }
}

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}

// Build the full-replace PUT/POST payload from the flat form. The backend PUT
// is full-replace: omitted fields are cleared. The form only edits a subset
// (en title/summary, image artifact, source label/platform/url), so when the
// original row is provided its un-edited JSON data — output_json, extra title
// or summary languages, source.captured_at, extra artifact/source keys — is
// merged back in instead of being silently dropped. The create path passes no
// original and behaves as before.
export function formDataToPayload(
  form: PromptGalleryFormData,
  original?: PromptLibraryAdminItem
) {
  const origTitle = original ? asRecord(safeParseJson(original.title_json)) : {}
  const origSummary = original
    ? asRecord(safeParseJson(original.summary_json))
    : {}
  const origArtifact = original
    ? asRecord(safeParseJson(original.artifact_json))
    : {}
  const origSource = original
    ? asRecord(safeParseJson(original.source_json))
    : {}
  const origOutput = original
    ? asRecord(safeParseJson(original.output_json))
    : {}

  // Summary: set/delete en per the form, keep other languages; only drop the
  // object entirely when it would be empty.
  const summary: JsonRecord = { ...origSummary }
  if (form.summaryEn.trim()) {
    summary.en = form.summaryEn.trim()
  } else {
    delete summary.en
  }

  const origKind = origArtifact.kind
  const artifactKind =
    typeof origKind === 'string' && origKind ? origKind : 'image'

  return {
    slug: form.slug.trim(),
    category: form.category,
    model: form.model.trim(),
    prompt: form.prompt,
    title: { ...origTitle, en: form.titleEn.trim() },
    summary: Object.keys(summary).length > 0 ? summary : undefined,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    artifact: {
      ...origArtifact,
      kind: artifactKind,
      url: form.imageUrl.trim(),
      alt: form.imageAlt.trim() || form.titleEn.trim(),
    },
    source: {
      // spread keeps captured_at and any extra keys from the original source
      ...origSource,
      label: form.sourceLabel.trim(),
      platform: form.sourcePlatform.trim() || 'Web',
      url: form.sourceUrl.trim(),
    },
    // the form has no output editor — pass the original through untouched
    output: Object.keys(origOutput).length > 0 ? origOutput : undefined,
    enabled: form.enabled,
  }
}

export function itemToFormData(
  item: PromptLibraryAdminItem
): PromptGalleryFormData {
  const title = asRecord(safeParseJson(item.title_json))
  const summary = asRecord(safeParseJson(item.summary_json))
  const artifact = asRecord(safeParseJson(item.artifact_json))
  const source = asRecord(safeParseJson(item.source_json))
  const tags = safeParseJson(item.tags_json)
  const stringOr = (value: unknown, fallback = '') =>
    typeof value === 'string' ? value : fallback
  return {
    slug: item.slug,
    category: item.category,
    model: item.model,
    prompt: item.prompt,
    titleEn: stringOr(title.en),
    summaryEn: stringOr(summary.en),
    tags: Array.isArray(tags) ? tags.join(', ') : '',
    imageUrl: stringOr(artifact.url),
    imageAlt: stringOr(artifact.alt),
    sourceLabel: stringOr(source.label),
    // source_json is authoritative but may lack these; fall back to the
    // denormalized top-level columns.
    sourcePlatform: stringOr(source.platform) || (item.source_platform ?? ''),
    sourceUrl: stringOr(source.url) || (item.source_url ?? ''),
    enabled: item.enabled,
  }
}
