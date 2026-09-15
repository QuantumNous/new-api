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
import { NotFoundError } from '@/features/errors/not-found-error'

import { getGuideDoc } from './catalog'
import { DocsArticle } from './components/docs-article'
import { DocsShell } from './components/docs-shell'
import { DocsSidebar } from './components/docs-sidebar'
import type { GuideDocSlug, GuideSearch } from './types'

type GuidePageProps = {
  slug: GuideDocSlug
  search: GuideSearch
  onSearchChange: (next: Partial<GuideSearch>) => void
}

export function GuidePage(props: GuidePageProps) {
  const doc = getGuideDoc(props.slug)
  if (!doc) return <NotFoundError />

  const query = props.search.q ?? ''
  const changeQuery = (nextQuery: string) =>
    props.onSearchChange({ q: nextQuery || undefined })

  return (
    <DocsShell
      sidebar={
        <DocsSidebar
          activeSlug={doc.slug}
          query={query}
          onQueryChange={changeQuery}
        />
      }
    >
      <DocsArticle
        doc={doc}
        search={props.search}
        onSearchChange={props.onSearchChange}
        mobileQuery={query}
        onMobileQueryChange={changeQuery}
      />
    </DocsShell>
  )
}
