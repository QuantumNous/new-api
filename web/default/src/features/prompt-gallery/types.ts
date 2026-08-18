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

export function formDataToPayload(form: PromptGalleryFormData) {
  return {
    slug: form.slug.trim(),
    category: form.category,
    model: form.model.trim(),
    prompt: form.prompt,
    title: { en: form.titleEn.trim() },
    summary: form.summaryEn.trim() ? { en: form.summaryEn.trim() } : undefined,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    artifact: {
      kind: 'image',
      url: form.imageUrl.trim(),
      alt: form.imageAlt.trim() || form.titleEn.trim(),
    },
    source: {
      label: form.sourceLabel.trim(),
      platform: form.sourcePlatform.trim() || 'Web',
      url: form.sourceUrl.trim(),
    },
    enabled: form.enabled,
  }
}

export function itemToFormData(
  item: PromptLibraryAdminItem
): PromptGalleryFormData {
  const parse = (raw: string) => {
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }
  const title = parse(item.title_json)
  const summary = parse(item.summary_json)
  const artifact = parse(item.artifact_json)
  const source = parse(item.source_json)
  const tags = parse(item.tags_json)
  return {
    slug: item.slug,
    category: item.category,
    model: item.model,
    prompt: item.prompt,
    titleEn: typeof title.en === 'string' ? title.en : '',
    summaryEn: typeof summary.en === 'string' ? summary.en : '',
    tags: Array.isArray(tags) ? tags.join(', ') : '',
    imageUrl: typeof artifact.url === 'string' ? artifact.url : '',
    imageAlt: typeof artifact.alt === 'string' ? artifact.alt : '',
    sourceLabel: typeof source.label === 'string' ? source.label : '',
    sourcePlatform: typeof source.platform === 'string' ? source.platform : '',
    sourceUrl: typeof source.url === 'string' ? source.url : '',
    enabled: item.enabled,
  }
}
