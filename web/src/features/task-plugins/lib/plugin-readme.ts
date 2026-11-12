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
import { findMarketplaceVersion } from './marketplace'
import {
  documentLocale,
  downloadPluginDocument,
  isDocumentLinkTarget,
  PluginDocumentFormatError,
  readFrontMatter,
  readFrontMatterTranslations,
  resolvePluginDocumentFiles,
  tokenLines,
  type PluginDocumentLocation,
} from './plugin-document'

export type PluginReadme = {
  /** The language shown, en when the reader's language has no guide. */
  locale: string
  /** Relative links resolve against this page. */
  sourceUrl: string
  /** The Markdown body without its front matter. */
  markdown: string
}

/** Raw HTML and images never reach the page, nested content included. */
function checkReadmeTokens(
  tokens: readonly Token[],
  raw: string,
  firstLine: number,
  location: PluginDocumentLocation
): void {
  const lines = tokenLines(tokens, raw, firstLine)
  for (const [i, token] of (tokens as MarkedToken[]).entries()) {
    const line = lines[i]
    if (token.type === 'html') {
      throw new PluginDocumentFormatError(location, line, 'html')
    }
    if (token.type === 'image') {
      throw new PluginDocumentFormatError(location, line, 'image')
    }
    if (token.type === 'link' && !isDocumentLinkTarget(token.href)) {
      throw new PluginDocumentFormatError(location, line, 'link')
    }
    if (token.type === 'list') {
      checkReadmeTokens(token.items, token.raw, line, location)
    } else if (token.type === 'table') {
      for (const cell of token.header) {
        checkReadmeTokens(cell.tokens, cell.text, line, location)
      }
      // Body rows start below the header and delimiter rows.
      for (const [row, cells] of token.rows.entries()) {
        for (const cell of cells) {
          checkReadmeTokens(cell.tokens, cell.text, line + 2 + row, location)
        }
      }
    } else if ('tokens' in token && token.tokens) {
      checkReadmeTokens(token.tokens, token.raw, line, location)
    }
  }
}

/**
 * Checks a usage guide before it is shown: optional front matter with only
 * `locale` and `translations`, a level-1 heading first, no raw HTML or
 * images, and links to http, https, mailto or relative targets.
 */
export function parsePluginReadme(
  text: string,
  locale: string,
  sourceUrl: string
): PluginReadme {
  const location = {
    name: locale === 'en' ? 'README.md' : `README.${locale}.md`,
    sourceUrl,
  }
  const frontMatter = readFrontMatter(text, location, {
    required: false,
    keys: ['locale', 'translations'],
  })
  if (
    frontMatter.data.locale !== undefined &&
    frontMatter.data.locale !== locale
  ) {
    throw new PluginDocumentFormatError(
      location,
      frontMatter.keyLine(['locale']),
      'identity'
    )
  }
  readFrontMatterTranslations(frontMatter, { ...location, locale }, 'README')
  const tokens = Lexer.lex(frontMatter.body, { gfm: true })
  const lines = tokenLines(tokens, frontMatter.body, frontMatter.bodyLine)
  // Link definitions render nothing, so the first block is the first visible one.
  const first = tokens.findIndex(
    (token) => token.type !== 'space' && token.type !== 'def'
  )
  const title = tokens[first] as MarkedToken | undefined
  if (title?.type !== 'heading' || title.depth !== 1) {
    throw new PluginDocumentFormatError(location, lines[first] ?? null, 'title')
  }
  checkReadmeTokens(tokens, frontMatter.body, frontMatter.bodyLine, location)
  return { locale, sourceUrl, markdown: frontMatter.body }
}

/**
 * Loads the usage guide the index lists for a version, in the reader's
 * language when it has one and in English otherwise. Null means the version
 * has no guide.
 */
export async function fetchPluginReadme(options: {
  indexUrl: string
  plugin: MarketplacePlugin
  version: string
  language: string
  signal: AbortSignal
}): Promise<PluginReadme | null> {
  const listed = findMarketplaceVersion(options.plugin, options.version)?.readme
  if (!listed) return null
  const files = resolvePluginDocumentFiles(
    options.indexUrl,
    listed,
    'README',
    documentLocale(options.language)
  )
  if (files.translation) {
    try {
      const text = await downloadPluginDocument(
        files.translation,
        options.signal
      )
      if (text !== null) {
        return parsePluginReadme(
          text,
          files.translation.locale,
          files.translation.sourceUrl
        )
      }
    } catch {
      // A missing, invalid or unavailable translation falls back to English.
      options.signal.throwIfAborted()
    }
  }
  if (!files.canonical) return null
  const text = await downloadPluginDocument(files.canonical, options.signal)
  if (text === null) return null
  return parsePluginReadme(text, 'en', files.canonical.sourceUrl)
}
