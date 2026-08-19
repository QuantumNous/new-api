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
import { describe, expect, it } from 'bun:test'
import {
  formDataToPayload,
  itemToFormData,
  type PromptLibraryAdminItem,
} from './types'

const item: PromptLibraryAdminItem = {
  id: 1,
  slug: 'rice-grain',
  category: 'image',
  model: 'gpt-image-2',
  prompt: 'A massive pile of rice',
  title_json: '{"en":"Rice Grain"}',
  summary_json: '{"en":"tiny text"}',
  tags_json: '["photography"]',
  output_json: '',
  artifact_json:
    '{"kind":"image","url":"https://storage.googleapis.com/b/rice.png","alt":"Rice"}',
  source_json:
    '{"label":"@adonis_singh","platform":"X","url":"https://x.com/a/status/1"}',
  source_platform: 'X',
  source_url: 'https://x.com/a/status/1',
  captured_at: '2026-08-19',
  enabled: true,
  created_time: 0,
  updated_time: 0,
}

describe('itemToFormData', () => {
  it('flattens JSON columns into editable fields', () => {
    const form = itemToFormData(item)
    expect(form.titleEn).toBe('Rice Grain')
    expect(form.imageUrl).toBe('https://storage.googleapis.com/b/rice.png')
    expect(form.tags).toBe('photography')
    expect(form.enabled).toBe(true)
  })

  it('tolerates malformed JSON columns', () => {
    const broken = { ...item, title_json: '{oops', artifact_json: '' }
    const form = itemToFormData(broken)
    expect(form.titleEn).toBe('')
    expect(form.imageUrl).toBe('')
  })

  it('treats literal-null JSON columns as empty', () => {
    const nulled = {
      ...item,
      title_json: 'null',
      summary_json: 'null',
      tags_json: 'null',
      artifact_json: 'null',
      source_json: 'null',
    }
    const form = itemToFormData(nulled)
    expect(form.titleEn).toBe('')
    expect(form.summaryEn).toBe('')
    expect(form.tags).toBe('')
    expect(form.imageUrl).toBe('')
    expect(form.imageAlt).toBe('')
    expect(form.sourceLabel).toBe('')
    expect(form.sourcePlatform).toBe('')
    expect(form.sourceUrl).toBe('')
    expect(form.enabled).toBe(true)
  })
})

describe('formDataToPayload', () => {
  it('round-trips form back to API payload shape', () => {
    const payload = formDataToPayload(itemToFormData(item))
    expect(payload.slug).toBe('rice-grain')
    expect(payload.title).toEqual({ en: 'Rice Grain' })
    expect(payload.artifact.url).toBe(
      'https://storage.googleapis.com/b/rice.png'
    )
    expect(payload.tags).toEqual(['photography'])
    expect(payload.enabled).toBe(true)
  })

  it('omits empty summary and splits tags', () => {
    const form = itemToFormData(item)
    form.summaryEn = ''
    form.tags = 'a, b , ,c'
    const payload = formDataToPayload(form)
    expect(payload.summary).toBeUndefined()
    expect(payload.tags).toEqual(['a', 'b', 'c'])
  })
})
