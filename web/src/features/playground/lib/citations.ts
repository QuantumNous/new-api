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
import type { Message } from '../types'

type UrlCitation = {
  type: 'url_citation'
  url_citation: {
    url: string
    title?: string
  }
}

function isSafeCitationUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isUrlCitation(value: unknown): value is UrlCitation {
  if (!value || typeof value !== 'object') return false

  const citation = value as Partial<UrlCitation>
  if (citation.type !== 'url_citation') return false
  if (!citation.url_citation || typeof citation.url_citation !== 'object') {
    return false
  }

  const urlCitation = citation.url_citation as Record<string, unknown>
  return (
    typeof urlCitation.url === 'string' &&
    (urlCitation.title === undefined || typeof urlCitation.title === 'string')
  )
}

export function mergeSources(
  current: Message['sources'] = [],
  incoming: Message['sources'] = []
): NonNullable<Message['sources']> {
  const sources = [...current]
  const seen = new Set(sources.map((source) => source.href))

  for (const source of incoming) {
    if (seen.has(source.href)) continue
    seen.add(source.href)
    sources.push(source)
  }

  return sources
}

export function parseUrlCitations(
  value: unknown
): NonNullable<Message['sources']> {
  if (!Array.isArray(value)) return []

  const sources: NonNullable<Message['sources']> = []
  for (const annotation of value) {
    if (!isUrlCitation(annotation)) continue

    const href = annotation.url_citation.url
    if (!isSafeCitationUrl(href)) continue

    sources.push({
      href,
      title: annotation.url_citation.title?.trim() || href,
    })
  }

  return mergeSources([], sources)
}
