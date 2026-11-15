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
import { isMap, isScalar, LineCounter, parseDocument } from 'yaml'

import type { MarketplaceDocument } from '../types'
import { isCanonicalLanguageTag, resolvePluginSourceUrl } from './marketplace'
import { fetchFromPluginSite } from './plugin-site'

// Usage guides (README.md) and release notes (CHANGELOG.md) share the
// download, front matter and problem reporting below.

const MAX_DOCUMENT_BYTES = 256 * 1024
const DOWNLOAD_TIMEOUT_MS = 30_000

/** Translate the app's language aliases to canonical document language tags. */
export function documentLocale(language: string): string {
  const normalized = language.trim().replaceAll('_', '-').toLowerCase()
  if (['zh', 'zhcn', 'zh-cn', 'zh-hans'].includes(normalized)) return 'zh-CN'
  if (['zhtw', 'zh-tw', 'zh-hant'].includes(normalized)) return 'zh-TW'
  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? 'en'
  } catch {
    return 'en'
  }
}

/** The file name an author sees, such as README.md or CHANGELOG.zh-CN.md. */
export type PluginDocumentLocation = {
  name: string
  /** Readers open this page, and relative links resolve against it. */
  sourceUrl: string
}

export type PluginDocumentFile = PluginDocumentLocation & {
  /** Download address on the index's own origin. */
  url: string
  locale: string
}

export type PluginDocumentProblemCode =
  | 'encoding'
  | 'front_matter'
  | 'changelog_version'
  | 'identity'
  | 'translation'
  | 'title'
  | 'release_heading'
  | 'unknown_category'
  | 'category_order'
  | 'category_list'
  | 'entry'
  | 'html'
  | 'image'
  | 'unsupported'
  | 'link'
  | 'no_change'

/** Network, timeout, an HTTP status other than 404, or the size limit. Retrying may help. */
export class PluginDocumentDownloadError extends Error {
  constructor(options?: ErrorOptions) {
    super('Plugin document download failed', options)
    this.name = 'PluginDocumentDownloadError'
  }
}

/** The file breaks a format rule; retrying does not help. */
export class PluginDocumentFormatError extends Error {
  readonly file: string
  /** 1-based, front matter counted; null for a problem with the whole file. */
  readonly line: number | null
  readonly code: PluginDocumentProblemCode
  readonly sourceUrl: string

  constructor(
    location: PluginDocumentLocation,
    line: number | null,
    code: PluginDocumentProblemCode
  ) {
    super(
      line === null
        ? `${location.name}: ${code}`
        : `${location.name} line ${line}: ${code}`
    )
    this.name = 'PluginDocumentFormatError'
    this.file = location.name
    this.line = line
    this.code = code
    this.sourceUrl = location.sourceUrl
  }
}

/** The English file and the reader's translation an index lists for a version. */
export function resolvePluginDocumentFiles(
  indexUrl: string,
  document: MarketplaceDocument,
  baseName: 'README' | 'CHANGELOG',
  locale: string
): {
  canonical: PluginDocumentFile | null
  translation: PluginDocumentFile | null
} {
  const canonicalUrl = resolvePluginSourceUrl(indexUrl, document.path)
  const entry =
    locale !== 'en' &&
    document.translations &&
    Object.hasOwn(document.translations, locale)
      ? document.translations[locale]
      : undefined
  const translationUrl = entry
    ? resolvePluginSourceUrl(indexUrl, entry.path)
    : null
  return {
    canonical: canonicalUrl
      ? {
          url: canonicalUrl,
          name: `${baseName}.md`,
          sourceUrl: document.sourceUrl ?? canonicalUrl,
          locale: 'en',
        }
      : null,
    translation:
      entry && translationUrl
        ? {
            url: translationUrl,
            name: `${baseName}.${locale}.md`,
            sourceUrl: entry.sourceUrl ?? translationUrl,
            locale,
          }
        : null,
  }
}

/**
 * Downloads a usage guide or changelog without cookies, redirects or a
 * referrer. Null means the file does not exist (HTTP 404).
 */
export async function downloadPluginDocument(
  file: PluginDocumentFile,
  signal: AbortSignal
): Promise<string | null> {
  signal.throwIfAborted()
  let response: Response
  try {
    response = await fetchFromPluginSite(file.url, {
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      ]),
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })
  } catch (error) {
    signal.throwIfAborted()
    throw new PluginDocumentDownloadError({ cause: error })
  }
  if (response.status === 404) {
    await response.body?.cancel()
    return null
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new PluginDocumentDownloadError()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_DOCUMENT_BYTES) throw new PluginDocumentDownloadError()
      chunks.push(value)
    }
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof PluginDocumentDownloadError) throw error
    throw new PluginDocumentDownloadError({ cause: error })
  } finally {
    // An errored stream rejects cancel with the same error already handled.
    await reader.cancel().catch(() => undefined)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new PluginDocumentFormatError(file, null, 'encoding')
  }
}

/** Links point to web or mail addresses, or relative to the file's page. */
export function isDocumentLinkTarget(href: string): boolean {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return true
  }
  return ['http:', 'https:', 'mailto:'].includes(url.protocol)
}

export type PluginDocumentFrontMatter = {
  /** Empty when the file has no front matter. */
  data: Record<string, unknown>
  body: string
  /** The file line where the body starts. */
  bodyLine: number
  /** The file line of a metadata key, such as ['translations', 'zh-CN']. */
  keyLine: (keyPath: string[]) => number
}

/**
 * Splits YAML front matter, parsed as plain data, from the Markdown body.
 * It starts on the first line with `---` and ends at the next `---` line.
 */
export function readFrontMatter(
  text: string,
  location: PluginDocumentLocation,
  options: { required: boolean; keys: readonly string[] }
): PluginDocumentFrontMatter {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  if (lines[0] !== '---') {
    if (options.required) {
      throw new PluginDocumentFormatError(location, 1, 'front_matter')
    }
    return { data: {}, body: lines.join('\n'), bodyLine: 1, keyLine: () => 1 }
  }
  const end = lines.indexOf('---', 1)
  if (end < 1) throw new PluginDocumentFormatError(location, 1, 'front_matter')
  const lineCounter = new LineCounter()
  const yaml = parseDocument(lines.slice(1, end).join('\n'), {
    schema: 'core',
    uniqueKeys: true,
    stringKeys: true,
    lineCounter,
  })
  const problem = yaml.errors[0] ?? yaml.warnings[0]
  if (problem) {
    throw new PluginDocumentFormatError(
      location,
      1 + (problem.linePos?.[0].line ?? 0),
      'front_matter'
    )
  }
  let data: unknown
  try {
    data = yaml.toJS({ maxAliasCount: 0 }) ?? {}
  } catch {
    // Aliases are refused outright.
    throw new PluginDocumentFormatError(location, 1, 'front_matter')
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new PluginDocumentFormatError(location, 2, 'front_matter')
  }
  const keyLine = (keyPath: string[]) => {
    const parent =
      keyPath.length > 1
        ? yaml.getIn(keyPath.slice(0, -1), true)
        : yaml.contents
    const pair = isMap(parent)
      ? parent.items.find(
          (item) => isScalar(item.key) && item.key.value === keyPath.at(-1)
        )
      : undefined
    const start = isScalar(pair?.key) ? pair.key.range?.[0] : undefined
    return start === undefined ? 1 : 1 + lineCounter.linePos(start).line
  }
  for (const key of Object.keys(data as object)) {
    if (!options.keys.includes(key)) {
      throw new PluginDocumentFormatError(
        location,
        keyLine([key]),
        'front_matter'
      )
    }
  }
  return {
    data: data as Record<string, unknown>,
    body: lines.slice(end + 1).join('\n'),
    bodyLine: end + 2,
    keyLine,
  }
}

/**
 * Reads the `translations` map an English file declares: canonical language
 * tags other than en, at most 10, each naming its sibling `<base>.<tag>.md`.
 */
export function readFrontMatterTranslations(
  frontMatter: PluginDocumentFrontMatter,
  location: PluginDocumentLocation & { locale: string },
  baseName: 'README' | 'CHANGELOG'
): Record<string, string> {
  const value = frontMatter.data.translations
  if (value === undefined) return {}
  const line = frontMatter.keyLine(['translations'])
  if (location.locale !== 'en') {
    throw new PluginDocumentFormatError(location, line, 'translation')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PluginDocumentFormatError(location, line, 'front_matter')
  }
  const entries = Object.entries(value)
  if (entries.length > 10) {
    throw new PluginDocumentFormatError(location, line, 'translation')
  }
  for (const [tag, file] of entries) {
    if (
      tag === 'en' ||
      !isCanonicalLanguageTag(tag) ||
      file !== `${baseName}.${tag}.md`
    ) {
      throw new PluginDocumentFormatError(
        location,
        frontMatter.keyLine(['translations', tag]),
        'translation'
      )
    }
  }
  return Object.fromEntries(entries) as Record<string, string>
}

/**
 * The file line where each sibling token starts, counted through the tokens'
 * raw text inside their parent's raw text.
 */
export function tokenLines(
  tokens: readonly { raw?: string }[],
  raw: string,
  firstLine: number
): number[] {
  const lines: number[] = []
  let cursor = 0
  let line = firstLine
  for (const token of tokens) {
    const start = token.raw ? raw.indexOf(token.raw, cursor) : -1
    if (start < 0) {
      lines.push(line)
      continue
    }
    for (; cursor < start; cursor++) {
      if (raw[cursor] === '\n') line++
    }
    lines.push(line)
    for (const end = start + (token.raw?.length ?? 0); cursor < end; cursor++) {
      if (raw[cursor] === '\n') line++
    }
  }
  return lines
}
