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
import { formatBytes } from '@/lib/format'

import type { RequestPluginConfigField } from '../types'

export const REQUEST_PLUGIN_INSTANCES_QUERY_KEY = ['request-plugin-instances']
export const REQUEST_PLUGIN_OPTIONS_QUERY_KEY = ['request-plugin-options']

/** Plain names of the stage hooks, in the order a request meets them. */
export const REQUEST_PLUGIN_STAGE_LABELS: Record<string, string> = {
  ingress: 'Before the request is read',
  request: 'Before format conversion',
  outbound: 'Before sending',
  egress: 'Final check',
  reply: 'Reply check',
  report: 'After the request',
}

/** Reasoning efforts by name, weakest first; "none" turns thinking off. */
export const REQUEST_PLUGIN_EFFORT_LABELS: Record<string, string> = {
  none: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

/** How the instance editor renders one config field. */
export type RequestPluginFieldKind =
  | 'boolean'
  | 'enum'
  | 'enumList'
  | 'lines'
  | 'rows'
  | 'modelValues'
  | 'json'
  | 'bytes'
  | 'number'
  | 'text'
  | 'textarea'

/** The parts of a config schema an object's fields come from. */
type RequestPluginConfigShape = {
  properties?: Record<string, RequestPluginConfigField>
  required?: string[]
}

export function requestPluginFieldKind(
  field: RequestPluginConfigField
): RequestPluginFieldKind {
  if (field.type === 'boolean') return 'boolean'
  if (field.enum?.length && field.type !== 'array' && field.type !== 'object') {
    return 'enum'
  }
  if (field.type === 'number' || field.type === 'integer') {
    return field.unit === 'byte' ? 'bytes' : 'number'
  }
  if (field.type === 'string') {
    return field.format === 'textarea' || field.format === 'keywords'
      ? 'textarea'
      : 'text'
  }
  if (field.type === 'array' && field.items?.type === 'string') {
    return field.items.enum?.length ? 'enumList' : 'lines'
  }
  // A list of flat objects is edited one row per item; anything nested
  // stays JSON.
  const itemFields = Object.values(field.items?.properties ?? {})
  if (
    field.type === 'array' &&
    field.items?.type === 'object' &&
    itemFields.length > 0 &&
    itemFields.every((item) => item.type !== 'array' && item.type !== 'object')
  ) {
    return 'rows'
  }
  const valueType = field.additionalProperties?.type
  if (
    field.type === 'object' &&
    !field.properties &&
    valueType !== undefined &&
    valueType !== 'array' &&
    valueType !== 'object'
  ) {
    return 'modelValues'
  }
  return 'json'
}

/**
 * The row of a value-per-model field: the model and its value, edited like
 * a row list item.
 */
export function requestPluginModelValueShape(
  field: RequestPluginConfigField
): RequestPluginConfigShape {
  return {
    properties: {
      model: { type: 'string', title: 'Model' },
      ...(field.additionalProperties && { value: field.additionalProperties }),
    },
    required: ['model', 'value'],
  }
}

/** A small whole-number range is picked with a slider. */
export function requestPluginFieldUsesSlider(field: RequestPluginConfigField) {
  return (
    field.type === 'integer' &&
    field.minimum !== undefined &&
    field.maximum !== undefined &&
    field.maximum - field.minimum <= 100
  )
}

/**
 * Whether a setting fits beside its title on one line. Lists, addresses,
 * patterns and long text take the full width under the title.
 */
export function requestPluginFieldInline(field: RequestPluginConfigField) {
  const kind = requestPluginFieldKind(field)
  if (kind === 'text') {
    return (
      field.format !== 'url' &&
      field.format !== 'regex' &&
      field.maxLength !== undefined &&
      field.maxLength <= 128
    )
  }
  return (
    kind === 'boolean' ||
    kind === 'enum' ||
    kind === 'number' ||
    kind === 'bytes'
  )
}

/** A row list whose items have a few short fields is edited as a table. */
export function requestPluginRowsAsTable(
  items: RequestPluginConfigField | undefined
) {
  const fields = Object.values(items?.properties ?? {})
  return (
    fields.length > 0 &&
    fields.length <= 4 &&
    fields.every((field) => {
      const kind = requestPluginFieldKind(field)
      if (kind === 'text') {
        return field.format !== 'url' && field.format !== 'password'
      }
      return kind === 'boolean' || kind === 'enum' || kind === 'number'
    })
  )
}

export const REQUEST_PLUGIN_BYTE_SCALES = [
  { label: 'B', scale: 1 },
  { label: 'KB', scale: 1000 },
  { label: 'MB', scale: 1000 * 1000 },
] as const

/** A byte value as typed: an amount and the unit it is typed in. */
export type RequestPluginBytesDraft = { amount: string; scale: number }

/** One item of a row list, with a key that survives reordering. */
export type RequestPluginConfigRow = {
  key: string
  values: RequestPluginConfigDraft
}

let rowKeySeed = 0

export function newRequestPluginConfigRow(
  values: RequestPluginConfigDraft
): RequestPluginConfigRow {
  rowKeySeed += 1
  return { key: `row-${rowKeySeed}`, values }
}

/** A new instance, or a new row, starts from the schema defaults. */
export function requestPluginConfigDefaults(
  schema: RequestPluginConfigShape | undefined
): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(schema?.properties ?? {})) {
    if (field.default !== undefined) {
      config[name] = structuredClone(field.default)
    }
  }
  return config
}

/**
 * The editor keeps typed text as typed: numbers, lines and JSON stay strings
 * until the instance is saved, so a half-typed value is not lost.
 */
export type RequestPluginConfigDraft = Record<string, unknown>

export function toRequestPluginConfigDraft(
  schema: RequestPluginConfigShape | undefined,
  config: Record<string, unknown>
): RequestPluginConfigDraft {
  const draft: RequestPluginConfigDraft = {}
  for (const [name, field] of Object.entries(schema?.properties ?? {})) {
    const value = config[name]
    switch (requestPluginFieldKind(field)) {
      case 'boolean':
        draft[name] = value === true
        break
      case 'enum':
        draft[name] = value
        break
      case 'enumList':
        draft[name] = Array.isArray(value) ? value.map(String) : []
        break
      case 'lines':
        draft[name] = Array.isArray(value) ? value.join('\n') : ''
        break
      case 'rows':
        draft[name] = (Array.isArray(value) ? value : []).map((item) =>
          newRequestPluginConfigRow(
            toRequestPluginConfigDraft(
              field.items,
              typeof item === 'object' && item !== null
                ? (item as Record<string, unknown>)
                : {}
            )
          )
        )
        break
      case 'modelValues':
        draft[name] = Object.entries(
          typeof value === 'object' && value !== null && !Array.isArray(value)
            ? value
            : {}
        ).map(([model, item]) =>
          newRequestPluginConfigRow(
            toRequestPluginConfigDraft(requestPluginModelValueShape(field), {
              model,
              value: item,
            })
          )
        )
        break
      case 'json':
        draft[name] = value === undefined ? '' : JSON.stringify(value, null, 2)
        break
      case 'bytes': {
        const bytes = typeof value === 'number' ? value : undefined
        // Shown in the largest unit that keeps the amount whole.
        const unit = [...REQUEST_PLUGIN_BYTE_SCALES]
          .reverse()
          .find((item) => bytes !== undefined && bytes % item.scale === 0)
        const scale = bytes ? (unit?.scale ?? 1) : 1000
        draft[name] = {
          amount: bytes === undefined ? '' : String(bytes / scale),
          scale,
        } satisfies RequestPluginBytesDraft
        break
      }
      default:
        draft[name] = value === undefined || value === null ? '' : String(value)
    }
  }
  return draft
}

/**
 * Whether a field shows, given the values its siblings hold now. A sibling
 * left empty counts as its default.
 */
export function requestPluginFieldVisible(
  field: RequestPluginConfigField,
  siblings: Record<string, RequestPluginConfigField>,
  draft: RequestPluginConfigDraft
): boolean {
  for (const [name, values] of Object.entries(field.visibleWhen ?? {})) {
    const sibling = siblings[name]
    let current: unknown = draft[name]
    if (current === undefined || current === '') current = sibling?.default
    if (
      typeof current === 'string' &&
      (sibling?.type === 'number' || sibling?.type === 'integer')
    ) {
      current = Number(current)
    }
    if (!values.some((value) => value === current)) return false
  }
  return true
}

/** A message key for a field, with the values it interpolates. */
export type RequestPluginFieldError = {
  message: string
  values?: Record<string, string | number>
}

/**
 * Turns the draft back into a config. Only fields the browser can tell are
 * malformed are reported, keyed by field name, or by
 * `list.rowKey.field` inside a row list; the gateway validates the rest. An
 * empty field is left out so the gateway applies its default. A hidden field
 * keeps its value and is not checked.
 */
export function fromRequestPluginConfigDraft(
  schema: RequestPluginConfigShape | undefined,
  draft: RequestPluginConfigDraft,
  prefix = ''
): {
  config: Record<string, unknown>
  errors: Record<string, RequestPluginFieldError>
} {
  const config: Record<string, unknown> = {}
  const errors: Record<string, RequestPluginFieldError> = {}
  const properties = schema?.properties ?? {}
  const required = new Set(schema?.required ?? [])
  for (const [name, field] of Object.entries(properties)) {
    const path = prefix + name
    const fieldErrors: Record<string, RequestPluginFieldError> = {}
    const value = draft[name]
    const kind = requestPluginFieldKind(field)
    let empty = false
    if (kind === 'boolean' || kind === 'enumList') {
      config[name] = value
    } else if (kind === 'enum') {
      empty = value === undefined || value === ''
      if (!empty) config[name] = value
    } else if (kind === 'rows') {
      const rows = Array.isArray(value)
        ? (value as RequestPluginConfigRow[])
        : []
      config[name] = rows.map((row) => {
        const parsed = fromRequestPluginConfigDraft(
          field.items,
          row.values,
          `${path}.${row.key}.`
        )
        Object.assign(fieldErrors, parsed.errors)
        return parsed.config
      })
    } else if (kind === 'modelValues') {
      const rows = Array.isArray(value)
        ? (value as RequestPluginConfigRow[])
        : []
      const values: Record<string, unknown> = {}
      for (const row of rows) {
        const parsed = fromRequestPluginConfigDraft(
          requestPluginModelValueShape(field),
          row.values,
          `${path}.${row.key}.`
        )
        Object.assign(fieldErrors, parsed.errors)
        const model = parsed.config.model
        if (typeof model !== 'string' || parsed.config.value === undefined) {
          continue
        }
        if (Object.hasOwn(values, model)) {
          fieldErrors[`${path}.${row.key}.model`] = {
            message: 'This model is already set',
          }
          continue
        }
        values[model] = parsed.config.value
      }
      if (Object.keys(values).length) config[name] = values
    } else if (kind === 'lines') {
      const lines = (typeof value === 'string' ? value : '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      if (lines.length) config[name] = lines
    } else {
      let text = typeof value === 'string' ? value : ''
      let scale = 1
      if (kind === 'bytes') {
        const bytes = value as RequestPluginBytesDraft | undefined
        text = bytes?.amount ?? ''
        scale = bytes?.scale ?? 1
      }
      empty = !text.trim()
      if (!empty) {
        const parsed = parseConfigText(field, kind, text, scale)
        if (parsed.error) fieldErrors[path] = parsed.error
        else config[name] = parsed.value
      }
    }
    if (empty && required.has(name)) {
      fieldErrors[path] = { message: 'This field is required' }
    }
    if (requestPluginFieldVisible(field, properties, draft)) {
      Object.assign(errors, fieldErrors)
    }
  }
  return { config, errors }
}

/** The addresses a url field accepts, as the gateway checks them. */
function isConfigURL(text: string) {
  try {
    const url = new URL(text)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username === '' &&
      url.password === '' &&
      url.hash === ''
    )
  } catch {
    return false
  }
}

function parseConfigText(
  field: RequestPluginConfigField,
  kind: RequestPluginFieldKind,
  text: string,
  scale: number
): { value?: unknown; error?: RequestPluginFieldError } {
  if (kind === 'json') {
    try {
      return { value: JSON.parse(text) }
    } catch {
      return { error: { message: 'Invalid JSON' } }
    }
  }
  if (kind !== 'number' && kind !== 'bytes') {
    if (field.format === 'url' && text !== '' && !isConfigURL(text)) {
      return {
        error: {
          message: 'Enter a full address starting with http:// or https://',
        },
      }
    }
    // A text within the limit in UTF-16 units is within it in characters
    // too, so a long keyword list is not split up on every keystroke.
    const length =
      field.minLength === undefined &&
      (field.maxLength === undefined || text.length <= field.maxLength)
        ? text.length
        : [...text].length
    if (field.maxLength !== undefined && length > field.maxLength) {
      return {
        error: {
          message: 'Enter at most {{count}} characters',
          values: { count: field.maxLength },
        },
      }
    }
    if (field.minLength !== undefined && length < field.minLength) {
      return {
        error: {
          message: 'Enter at least {{count}} characters',
          values: { count: field.minLength },
        },
      }
    }
    return { value: text }
  }
  const number = Number(text) * scale
  if (!Number.isFinite(number)) return { error: { message: 'Enter a number' } }
  if (field.type === 'integer' && !Number.isInteger(number)) {
    return { error: { message: 'Enter a whole number' } }
  }
  const bound = (value: number) =>
    kind === 'bytes' ? formatBytes(value) : String(value)
  if (field.minimum !== undefined && number < field.minimum) {
    return {
      error: {
        message: 'Enter at least {{value}}',
        values: { value: bound(field.minimum) },
      },
    }
  }
  if (field.maximum !== undefined && number > field.maximum) {
    return {
      error: {
        message: 'Enter at most {{value}}',
        values: { value: bound(field.maximum) },
      },
    }
  }
  return { value: number }
}

/** Formats a request can be tried in, with the client path each one uses. */
export const REQUEST_PLUGIN_DRY_RUN_FORMATS = [
  { value: 'openai', label: 'OpenAI Chat Completions', model: 'gpt-4.1-mini' },
  {
    value: 'openai_responses',
    label: 'OpenAI Responses',
    model: 'gpt-4.1-mini',
  },
  { value: 'claude', label: 'Claude Messages', model: 'claude-sonnet-4-5' },
  { value: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' },
] as const

export function requestPluginDryRunPath(format: string, model: string) {
  if (format === 'openai_responses') return '/v1/responses'
  if (format === 'claude') return '/v1/messages'
  if (format === 'gemini') return `/v1beta/models/${model}:generateContent`
  return '/v1/chat/completions'
}

const EXAMPLE_PROMPT =
  'My email is alice@example.com. Summarize the attached sales notes in three bullet points.'

/** A realistic request in each format, for the dry run body. */
export function requestPluginDryRunExample(format: string, model: string) {
  if (format === 'openai_responses') {
    return {
      model,
      instructions: 'You are a concise assistant.',
      input: [{ role: 'user', content: EXAMPLE_PROMPT }],
      reasoning: { effort: 'low' },
    }
  }
  if (format === 'claude') {
    return {
      model,
      max_tokens: 1024,
      system: 'You are a concise assistant.',
      messages: [{ role: 'user', content: EXAMPLE_PROMPT }],
    }
  }
  if (format === 'gemini') {
    return {
      systemInstruction: { parts: [{ text: 'You are a concise assistant.' }] },
      contents: [{ role: 'user', parts: [{ text: EXAMPLE_PROMPT }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }
  }
  return {
    model,
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user', content: EXAMPLE_PROMPT },
    ],
    stream: false,
  }
}
