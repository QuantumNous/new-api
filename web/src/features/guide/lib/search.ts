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
import { getGuideSectionSearchText, guideDocs } from '../catalog'
import type { GuideSearchHit } from '../types'

export function searchGuideDocs(
  query: string,
  translate: (key: string) => string
): GuideSearchHit[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return []

  const hits: GuideSearchHit[] = []
  for (const doc of guideDocs) {
    const translatedTitle = translate(doc.title)
    const summary = translate(doc.summary)
    if (`${translatedTitle} ${summary}`.toLocaleLowerCase().includes(needle)) {
      hits.push({
        id: `${doc.slug}-overview`,
        slug: doc.slug,
        sectionId: doc.sections[0]?.id ?? '',
        title: translatedTitle,
        snippet: summary,
      })
    }

    for (const section of doc.sections) {
      if (hits.length >= 10) return hits
      const sectionText = getGuideSectionSearchText(section, translate)
      if (!sectionText.toLocaleLowerCase().includes(needle)) continue
      if (hits.some((hit) => hit.slug === doc.slug)) continue
      hits.push({
        id: `${doc.slug}-${section.id}`,
        slug: doc.slug,
        sectionId: section.id,
        title: translatedTitle,
        snippet: translate(section.title),
      })
    }
  }
  return hits.slice(0, 10)
}
