/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) a later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { Link } from '@tanstack/react-router'

import { DOC_TOPICS } from '../lib/docs-data'

const baseItemClass =
  'block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeItemClass = 'bg-muted font-medium text-foreground'

export function DocsSidebar() {
  return (
    <nav className='space-y-1'>
      <Link
        to='/docs'
        activeOptions={{ exact: true }}
        className={baseItemClass}
        activeProps={{ className: activeItemClass }}
      >
        概览
      </Link>
      {DOC_TOPICS.map((topic) => (
        <Link
          key={topic.slug}
          to='/docs/$topic'
          params={{ topic: topic.slug }}
          className={baseItemClass}
          activeProps={{ className: activeItemClass }}
        >
          {topic.title}
        </Link>
      ))}
    </nav>
  )
}
