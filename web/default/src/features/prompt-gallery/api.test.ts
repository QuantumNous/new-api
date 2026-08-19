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
      // clear the denormalized columns too: sourcePlatform/sourceUrl fall
      // back to them when source_json lacks the keys (covered below)
      source_platform: '',
      source_url: '',
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

  it('falls back to top-level source columns when source_json lacks them', () => {
    const sparse = {
      ...item,
      source_json: '{"label":"@adonis_singh"}',
      source_platform: 'X',
      source_url: 'https://x.com/a/status/1',
    }
    const form = itemToFormData(sparse)
    expect(form.sourceLabel).toBe('@adonis_singh')
    expect(form.sourcePlatform).toBe('X')
    expect(form.sourceUrl).toBe('https://x.com/a/status/1')
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

  it('preserves un-edited JSON data when the original row is provided', () => {
    const rich: PromptLibraryAdminItem = {
      ...item,
      title_json: '{"en":"Rice Grain","zh":"米粒"}',
      summary_json: '{"en":"tiny text","zh":"小字"}',
      output_json: '{"translation":"tiny text on rice","ratio":"1:1"}',
      artifact_json:
        '{"kind":"image","url":"https://storage.googleapis.com/b/rice.png","alt":"Rice","width":1024}',
      source_json:
        '{"label":"@adonis_singh","platform":"X","url":"https://x.com/a/status/1","captured_at":"2026-08-05"}',
    }
    const form = itemToFormData(rich)
    form.titleEn = 'Rice Grain (edited)'
    const payload = formDataToPayload(form, rich)
    // edited en title applied, extra language kept
    expect(payload.title).toEqual({ en: 'Rice Grain (edited)', zh: '米粒' })
    // untouched summary language survives alongside the form's en
    expect(payload.summary).toEqual({ en: 'tiny text', zh: '小字' })
    // output passed through although the form has no output editor
    expect(payload.output).toEqual({
      translation: 'tiny text on rice',
      ratio: '1:1',
    })
    // captured_at and extra artifact keys preserved
    expect(payload.source).toEqual({
      label: '@adonis_singh',
      platform: 'X',
      url: 'https://x.com/a/status/1',
      captured_at: '2026-08-05',
    })
    expect(payload.artifact).toEqual({
      kind: 'image',
      url: 'https://storage.googleapis.com/b/rice.png',
      alt: 'Rice',
      width: 1024,
    })
  })

  it('keeps other summary languages when the form clears en, drops empty summary', () => {
    const rich: PromptLibraryAdminItem = {
      ...item,
      summary_json: '{"en":"tiny text","zh":"小字"}',
    }
    const form = itemToFormData(rich)
    form.summaryEn = ''
    const payload = formDataToPayload(form, rich)
    expect(payload.summary).toEqual({ zh: '小字' })

    const enOnly: PromptLibraryAdminItem = {
      ...item,
      summary_json: '{"en":"tiny text"}',
    }
    const enOnlyForm = itemToFormData(enOnly)
    enOnlyForm.summaryEn = ''
    expect(formDataToPayload(enOnlyForm, enOnly).summary).toBeUndefined()
  })

  it('without an original the create payload keeps its previous shape', () => {
    const form = itemToFormData(item)
    const payload = formDataToPayload(form)
    expect(payload.title).toEqual({ en: 'Rice Grain' })
    expect(payload.artifact).toEqual({
      kind: 'image',
      url: 'https://storage.googleapis.com/b/rice.png',
      alt: 'Rice',
    })
    expect(payload.source).toEqual({
      label: '@adonis_singh',
      platform: 'X',
      url: 'https://x.com/a/status/1',
    })
    expect(payload.output).toBeUndefined()
  })
})
