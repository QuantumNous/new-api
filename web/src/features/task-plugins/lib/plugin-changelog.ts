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
import { Lexer, type MarkedToken, type Token } from 'marked'

import type { MarketplacePlugin } from '../types'
import {
  DEFAULT_MARKETPLACE_INDEX_URL,
  GITHUB_MARKETPLACE_INDEX_URL,
  findMarketplaceVersion,
  resolvePluginSourceUrl,
} from './marketplace'
import {
  documentLocale,
  downloadPluginDocument,
  isDocumentLinkTarget,
  PluginDocumentFormatError,
  readFrontMatter,
  readFrontMatterTranslations,
  resolvePluginDocumentFiles,
  tokenLines,
  type PluginDocumentFile,
  type PluginDocumentLocation,
} from './plugin-document'

export const CHANGELOG_CATEGORIES = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
  'Migration',
] as const
export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number]
export type PluginChangelog = {
  plugin: string
  version: string
  locale: string
  sourceUrl: string
  sections: { category: ChangelogCategory; markdown: string }[]
}

type ChangelogIdentity = { plugin: string; version: string; locale: string }
const CHANGELOG_METADATA_KEYS = [
  'changelogVersion',
  'plugin',
  'version',
  'locale',
  'translations',
] as const

/**
 * Derives `CHANGELOG.md` beside the version's `plugin.js`, for index entries
 * that do not list a changelog. Includes the official proxy index.
 */
export function resolvePluginChangelogUrl(
  indexUrl: string,
  plugin: MarketplacePlugin,
  version: string
): string | null {
  const entry = findMarketplaceVersion(plugin, version)
  if (!entry) return null
  const source = resolvePluginSourceUrl(indexUrl, entry.path)
  if (!source) return null
  const url = new URL(source)
  if (url.username || url.password || !url.pathname.endsWith('/plugin.js')) {
    return null
  }
  // The official website rewrites plugin paths into download API URLs. Its
  // release sidecars still live beside the same key/version in the official repo.
  if (indexUrl.trim() === DEFAULT_MARKETPLACE_INDEX_URL) {
    if (
      ![plugin.key, version].every(
        (id) => /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..'
      )
    ) {
      return null
    }
    const expected = new URL(`${plugin.key}/${version}/plugin.js`, indexUrl)
    if (url.pathname !== expected.pathname) return null
    return new URL(
      `plugins/tasks/${plugin.key}/${version}/CHANGELOG.md`,
      GITHUB_MARKETPLACE_INDEX_URL
    ).href
  }
  return new URL('CHANGELOG.md', url).href
}

/** No HTML, images, task checkboxes or nested blocks can become marketplace content. */
function validateChangelogInline(
  tokens: Token[],
  raw: string,
  firstLine: number,
  location: PluginDocumentLocation,
  depth = 0
): void {
  if (depth > 32) {
    throw new PluginDocumentFormatError(location, firstLine, 'unsupported')
  }
  const lines = tokenLines(tokens, raw, firstLine)
  for (const [i, token] of (tokens as MarkedToken[]).entries()) {
    switch (token.type) {
      case 'text':
        if (token.tokens) {
          validateChangelogInline(
            token.tokens,
            token.raw,
            lines[i],
            location,
            depth + 1
          )
        }
        break
      case 'escape':
      case 'codespan':
      case 'br':
        break
      case 'link':
        if (!isDocumentLinkTarget(token.href)) {
          throw new PluginDocumentFormatError(location, lines[i], 'link')
        }
        validateChangelogInline(
          token.tokens,
          token.raw,
          lines[i],
          location,
          depth + 1
        )
        break
      case 'strong':
      case 'em':
      case 'del':
        validateChangelogInline(
          token.tokens,
          token.raw,
          lines[i],
          location,
          depth + 1
        )
        break
      case 'html':
        throw new PluginDocumentFormatError(location, lines[i], 'html')
      case 'image':
        throw new PluginDocumentFormatError(location, lines[i], 'image')
      default:
        throw new PluginDocumentFormatError(location, lines[i], 'unsupported')
    }
  }
}

export function parsePluginChangelog(
  text: string,
  identity: ChangelogIdentity,
  sourceUrl: string
): { document: PluginChangelog; translations: Record<string, string> } {
  const location = {
    name:
      identity.locale === 'en'
        ? 'CHANGELOG.md'
        : `CHANGELOG.${identity.locale}.md`,
    sourceUrl,
  }
  const frontMatter = readFrontMatter(text, location, {
    required: true,
    keys: CHANGELOG_METADATA_KEYS,
  })
  const metadata = frontMatter.data
  if (metadata.changelogVersion !== 1) {
    throw new PluginDocumentFormatError(
      location,
      frontMatter.keyLine(['changelogVersion']),
      metadata.changelogVersion === undefined
        ? 'front_matter'
        : 'changelog_version'
    )
  }
  for (const key of ['plugin', 'version', 'locale'] as const) {
    const value = metadata[key]
    if (typeof value !== 'string' || !value) {
      throw new PluginDocumentFormatError(
        location,
        frontMatter.keyLine([key]),
        'front_matter'
      )
    }
    if (value !== identity[key]) {
      throw new PluginDocumentFormatError(
        location,
        frontMatter.keyLine([key]),
        'identity'
      )
    }
  }
  const translations = readFrontMatterTranslations(
    frontMatter,
    { ...location, locale: identity.locale },
    'CHANGELOG'
  )

  const tokens: MarkedToken[] = []
  const lines: number[] = []
  const lexed = Lexer.lex(frontMatter.body, { gfm: true }) as MarkedToken[]
  const lexedLines = tokenLines(lexed, frontMatter.body, frontMatter.bodyLine)
  for (const [i, token] of lexed.entries()) {
    if (token.type === 'space') continue
    tokens.push(token)
    lines.push(lexedLines[i])
  }
  const title = tokens[0]
  if (
    title?.type !== 'heading' ||
    title.depth !== 1 ||
    title.text !== 'Changelog'
  ) {
    throw new PluginDocumentFormatError(location, lines[0] ?? null, 'title')
  }
  const release = tokens[1]
  if (
    release?.type !== 'heading' ||
    release.depth !== 2 ||
    release.text !== `[${identity.version}]`
  ) {
    throw new PluginDocumentFormatError(
      location,
      lines[1] ?? null,
      'release_heading'
    )
  }
  const sections: PluginChangelog['sections'] = []
  let previousCategory = -1
  for (let i = 2; i < tokens.length; i += 2) {
    const heading = tokens[i]
    if (heading.type !== 'heading' || heading.depth !== 3) {
      throw new PluginDocumentFormatError(location, lines[i], 'unsupported')
    }
    const categoryIndex = (CHANGELOG_CATEGORIES as readonly string[]).indexOf(
      heading.text
    )
    if (categoryIndex < 0) {
      throw new PluginDocumentFormatError(
        location,
        lines[i],
        'unknown_category'
      )
    }
    if (categoryIndex <= previousCategory) {
      throw new PluginDocumentFormatError(location, lines[i], 'category_order')
    }
    previousCategory = categoryIndex
    const list = tokens[i + 1]
    if (list?.type !== 'list' || list.ordered || !list.items.length) {
      throw new PluginDocumentFormatError(
        location,
        lines[i + 1] ?? lines[i],
        'category_list'
      )
    }
    const itemLines = tokenLines(list.items, list.raw, lines[i + 1])
    for (const [j, item] of list.items.entries()) {
      const blocks = item.tokens.filter(
        (token) => token.type !== 'space'
      ) as MarkedToken[]
      const paragraph = blocks[0]
      if (blocks.some((block) => block.type === 'html')) {
        throw new PluginDocumentFormatError(location, itemLines[j], 'html')
      }
      if (
        item.task ||
        blocks.length !== 1 ||
        (paragraph?.type !== 'text' && paragraph?.type !== 'paragraph') ||
        !paragraph.text.trim() ||
        !paragraph.tokens
      ) {
        throw new PluginDocumentFormatError(location, itemLines[j], 'entry')
      }
      validateChangelogInline(
        paragraph.tokens,
        paragraph.raw,
        itemLines[j],
        location
      )
    }
    sections.push({
      category: CHANGELOG_CATEGORIES[categoryIndex],
      markdown: list.raw,
    })
  }
  if (!sections.some((section) => section.category !== 'Migration')) {
    throw new PluginDocumentFormatError(location, null, 'no_change')
  }
  return { document: { ...identity, sourceUrl, sections }, translations }
}

/**
 * Loads the release notes in the reader's language. Index entries that list
 * a changelog use it; older entries fall back to `CHANGELOG.md` beside
 * `plugin.js` and the translations its front matter names. Null means the
 * version has no changelog.
 */
export async function fetchPluginChangelog(options: {
  indexUrl: string
  plugin: MarketplacePlugin
  version: string
  language: string
  signal: AbortSignal
}): Promise<PluginChangelog | null> {
  const listed = findMarketplaceVersion(
    options.plugin,
    options.version
  )?.changelog
  const locale = documentLocale(options.language)
  let canonical: PluginDocumentFile | null = null
  let translation: PluginDocumentFile | null = null
  if (listed) {
    ;({ canonical, translation } = resolvePluginDocumentFiles(
      options.indexUrl,
      listed,
      'CHANGELOG',
      locale
    ))
  } else {
    const url = resolvePluginChangelogUrl(
      options.indexUrl,
      options.plugin,
      options.version
    )
    if (url) {
      canonical = { url, name: 'CHANGELOG.md', sourceUrl: url, locale: 'en' }
    }
  }
  if (!canonical) return null
  const text = await downloadPluginDocument(canonical, options.signal)
  if (text === null) return null
  const identity = {
    plugin: options.plugin.key,
    version: options.version,
    locale: 'en',
  }
  const english = parsePluginChangelog(text, identity, canonical.sourceUrl)
  if (!listed && Object.hasOwn(english.translations, locale)) {
    const url = new URL(english.translations[locale], canonical.url).href
    translation = {
      url,
      name: `CHANGELOG.${locale}.md`,
      sourceUrl: url,
      locale,
    }
  }
  if (!translation) return english.document
  try {
    const translatedText = await downloadPluginDocument(
      translation,
      options.signal
    )
    if (translatedText !== null) {
      const translated = parsePluginChangelog(
        translatedText,
        { ...identity, locale },
        translation.sourceUrl
      )
      if (
        translated.document.sections.length ===
          english.document.sections.length &&
        translated.document.sections.every(
          (section, i) =>
            section.category === english.document.sections[i].category
        )
      ) {
        return translated.document
      }
    }
  } catch {
    // A missing, invalid or unavailable translation always falls back to English.
    options.signal.throwIfAborted()
  }
  return english.document
}
