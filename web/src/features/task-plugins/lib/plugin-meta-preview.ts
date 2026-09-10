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
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { z } from 'zod'

import type {
  MarketplaceIndexVersion,
  MarketplacePlugin,
  PluginMetaPreview,
  PluginPreviewField,
  PluginPreviewValues,
} from '../types'
import { MAX_PLUGIN_SOURCE_BYTES, pluginSourceByteLength } from './plugin-url'

const nonemptyString = z.string().min(1)
export const pluginProtocolClaimsSchema = z.array(
  z.union([
    nonemptyString,
    z.object({
      name: nonemptyString,
      models: z.array(nonemptyString).optional(),
      supports: z.array(z.enum(['stream', 'sync', 'background'])).optional(),
    }),
  ])
)

const previewSchemas = {
  models: z.array(nonemptyString),
  protocols: pluginProtocolClaimsSchema,
  routes: z.array(
    z.object({
      method: nonemptyString,
      path: nonemptyString,
      type: z.enum(['submit', 'query', 'dynamic']),
      models: z.array(nonemptyString).optional(),
    })
  ),
  channelTypes: z.array(z.number().int().nonnegative()),
  baseUrl: z.string(),
  allowedHosts: z.array(nonemptyString),
  auth: z
    .union([z.string(), z.object({ type: z.string() })])
    .transform((auth) => (typeof auth === 'string' ? auth : auth.type)),
}

type SyntaxNode = ReturnType<typeof javascriptLanguage.parser.parse>['topNode']
const unresolved = Symbol('unresolved static metadata')
type StaticValue =
  | string
  | number
  | boolean
  | null
  | StaticValue[]
  | { [key: string]: StaticValue }

/** Decode JavaScript string tokens without evaluating code, including JS-only escapes. */
function readStaticString(token: string): string | typeof unresolved {
  const quote = token[0]
  if (!['"', "'", '`'].includes(quote) || token.at(-1) !== quote) {
    return unresolved
  }
  let result = ''
  for (let i = 1; i < token.length - 1; i += 1) {
    const character = token[i]
    if (character !== '\\') {
      result += character
      continue
    }
    i += 1
    const escape = token[i]
    if (escape === undefined) return unresolved
    const escapes: Record<string, string> = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
    }
    if (Object.hasOwn(escapes, escape)) {
      result += escapes[escape]
    } else if (escape === '\n' || escape === '\u2028' || escape === '\u2029') {
      continue
    } else if (escape === '\r') {
      if (token[i + 1] === '\n') i += 1
    } else if (escape === '0' && !/[0-9]/.test(token[i + 1] ?? '')) {
      result += '\0'
    } else if (escape === 'u' || escape === 'x') {
      const braced = escape === 'u' && token[i + 1] === '{'
      const start = i + (braced ? 2 : 1)
      const end = braced
        ? token.indexOf('}', start)
        : start + (escape === 'x' ? 2 : 4)
      const digits = token.slice(start, end)
      if (end < start || !/^[0-9a-f]+$/i.test(digits)) return unresolved
      const code = Number.parseInt(digits, 16)
      if (code > 0x10ffff) return unresolved
      result += String.fromCodePoint(code)
      i = braced ? end : end - 1
    } else if (/[0-9]/.test(escape)) {
      return unresolved
    } else {
      result += escape
    }
  }
  return result
}

/** Dynamic keys/spreads could replace any field, so the entire object is unknown. */
function staticObjectProperties(
  source: string,
  node: SyntaxNode
): Map<string, SyntaxNode | null> | null {
  if (node.name !== 'ObjectExpression') return null
  const fields = new Map<string, SyntaxNode | null>()
  for (const property of node.getChildren('Property')) {
    const keyNode = property.firstChild
    if (
      !keyNode ||
      !['PropertyDefinition', 'String', 'Number', 'get', 'set'].includes(
        keyNode.name
      )
    ) {
      return null
    }
    const namedKey = ['get', 'set'].includes(keyNode.name)
      ? property.getChild('PropertyDefinition')
      : keyNode
    if (!namedKey) return null
    const token = source.slice(namedKey.from, namedKey.to)
    const key = namedKey.name === 'String' ? readStaticString(token) : token
    if (key === unresolved || key.includes('\\') || key === '__proto__') {
      return null
    }
    const colon = property.getChild(':')
    let value = colon?.nextSibling ?? null
    while (value && ['LineComment', 'BlockComment'].includes(value.name)) {
      value = value.nextSibling
    }
    fields.set(key, fields.has(key) ? null : value)
  }
  return fields
}

function readStaticValue(
  source: string,
  node: SyntaxNode,
  depth = 0
): StaticValue | typeof unresolved {
  if (depth > 64) return unresolved
  const token = source.slice(node.from, node.to)
  if (node.name === 'String') return readStaticString(token)
  if (node.name === 'TemplateString' && !node.getChild('Interpolation')) {
    return readStaticString(token)
  }
  if (node.name === 'Number') {
    const number = Number(token.replaceAll('_', ''))
    return Number.isFinite(number) ? number : unresolved
  }
  if (node.name === 'BooleanLiteral') return token === 'true'
  if (node.name === 'null') return null
  if (node.name === 'UnaryExpression') {
    const operand = node.lastChild
    const operator = node.firstChild
    if (!operand || !operator || operand.name !== 'Number') return unresolved
    const sign = source.slice(operator.from, operator.to)
    if (sign !== '-' && sign !== '+') return unresolved
    const value = readStaticValue(source, operand, depth + 1)
    if (typeof value !== 'number') return unresolved
    return sign === '-' ? -value : value
  }
  if (node.name === 'ArrayExpression') {
    const values: StaticValue[] = []
    let expectsValue = true
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (['[', ']', 'LineComment', 'BlockComment'].includes(child.name)) {
        continue
      }
      if (child.name === ',') {
        if (expectsValue) return unresolved
        expectsValue = true
        continue
      }
      if (!expectsValue) return unresolved
      const value = readStaticValue(source, child, depth + 1)
      if (value === unresolved) return unresolved
      values.push(value)
      expectsValue = false
    }
    return values
  }
  if (node.name === 'ObjectExpression') {
    const properties = staticObjectProperties(source, node)
    if (!properties) return unresolved
    const result: { [key: string]: StaticValue } = Object.create(null)
    for (const [key, valueNode] of properties) {
      if (!valueNode) return unresolved
      const value = readStaticValue(source, valueNode, depth + 1)
      if (value === unresolved) return unresolved
      result[key] = value
    }
    return result
  }
  return unresolved
}

/** Inspect only the exported literal declaration. Never compile or run the plugin. */
export function parsePluginMetaPreview(source: string): PluginMetaPreview {
  const fields = Object.fromEntries(
    Object.keys(previewSchemas).map((key) => [key, { state: 'unknown' }])
  ) as PluginMetaPreview['fields']
  const result: PluginMetaPreview = { status: 'unavailable', fields }
  if (pluginSourceByteLength(source) > MAX_PLUGIN_SOURCE_BYTES) return result
  const tree = javascriptLanguage.parser.parse(source)
  let invalid = false
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) invalid = true
    },
  })
  if (invalid) return result
  let meta: SyntaxNode | null = null
  for (const exported of tree.topNode.getChildren('ExportDeclaration')) {
    const declaration = exported.getChild('VariableDeclaration')
    if (!declaration?.getChild('const')) continue
    for (const variable of declaration.getChildren('VariableDefinition')) {
      if (source.slice(variable.from, variable.to) !== 'meta') continue
      if (meta) return result
      let next = variable.nextSibling
      while (next && ['LineComment', 'BlockComment'].includes(next.name)) {
        next = next.nextSibling
      }
      if (next?.name !== 'Equals') return result
      next = next.nextSibling
      while (next && ['LineComment', 'BlockComment'].includes(next.name)) {
        next = next.nextSibling
      }
      meta = next
    }
  }
  if (!meta) return result
  // A reference elsewhere may mutate or pass the object to arbitrary code.
  // Do not present the initial literal as complete when that is possible.
  tree.iterate({
    enter: (node) => {
      if (
        node.name === 'VariableName' &&
        source.slice(node.from, node.to) === 'meta'
      ) {
        invalid = true
      }
    },
  })
  if (invalid) return result
  const properties = staticObjectProperties(source, meta)
  if (!properties) return result
  result.status = 'parsed'
  for (const key of Object.keys(
    previewSchemas
  ) as (keyof PluginPreviewValues)[]) {
    if (!properties.has(key)) {
      fields[key] = { state: 'missing', origin: 'source' }
      continue
    }
    const node = properties.get(key)
    const value = node ? readStaticValue(source, node) : unresolved
    const parsed = previewSchemas[key].safeParse(value)
    if (!parsed.success) {
      result.status = 'partial'
      continue
    }
    // Each schema corresponds to the same-named field in PluginPreviewValues.
    Object.assign(fields, {
      [key]: { state: 'value', value: parsed.data, origin: 'source' },
    })
  }
  return result
}

/** Source absence is a fact; only unresolved source fields fall back to index hints. */
export function resolvePluginMetaPreview(
  plugin: MarketplacePlugin,
  version: MarketplaceIndexVersion | undefined,
  source: PluginMetaPreview | undefined
): PluginMetaPreview['fields'] {
  const latest = version?.version === plugin.latest
  const index = {
    models: latest ? plugin.models : undefined,
    protocols: latest ? plugin.protocols : undefined,
    channelTypes: latest ? plugin.channelTypes : undefined,
    routes: undefined,
    baseUrl: version?.baseUrl,
    allowedHosts: version?.allowedHosts,
    auth: version?.auth,
  }
  const fields = {} as PluginMetaPreview['fields']
  for (const key of Object.keys(
    previewSchemas
  ) as (keyof PluginPreviewValues)[]) {
    const fromSource = source?.fields[key]
    let field: PluginPreviewField<unknown> = fromSource ?? { state: 'unknown' }
    if (!fromSource || fromSource.state === 'unknown') {
      const parsed = previewSchemas[key].safeParse(index[key])
      if (parsed.success) {
        field = { state: 'value', value: parsed.data, origin: 'index' }
      }
    }
    Object.assign(fields, { [key]: field })
  }
  return fields
}
