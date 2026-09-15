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
import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { guideDocs } from '../catalog'
import { searchGuideDocs } from '../lib/search'
import type { GuideDoc, GuideDocSlug, GuideGroup } from '../types'

const GROUPS: Array<{ id: GuideGroup; label: string }> = [
  { id: 'start', label: 'Start here' },
  { id: 'coding', label: 'Coding tools' },
  { id: 'desktop', label: 'Desktop apps' },
  { id: 'help', label: 'Help' },
]

type DocsSidebarProps = {
  activeSlug: GuideDocSlug
  query: string
  onQueryChange: (query: string) => void
  onNavigate?: () => void
}

function GuideLink(props: {
  doc: GuideDoc
  className: string
  children: React.ReactNode
  hash?: string
  onClick?: () => void
}) {
  if (props.doc.slug === 'quick-start') {
    return (
      <Link
        to='/guide'
        hash={props.hash}
        className={props.className}
        onClick={props.onClick}
      >
        {props.children}
      </Link>
    )
  }
  return (
    <Link
      to='/guide/$slug'
      params={{ slug: props.doc.slug }}
      hash={props.hash}
      className={props.className}
      onClick={props.onClick}
    >
      {props.children}
    </Link>
  )
}

export function DocsSidebar(props: DocsSidebarProps) {
  const { t } = useTranslation()
  const hits = searchGuideDocs(props.query, t)

  return (
    <nav aria-label={t('Documentation')} className='flex min-h-0 flex-col'>
      <label className='relative block px-3 pt-4 pb-3'>
        <span className='sr-only'>{t('Search documentation')}</span>
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={2}
          className='text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-[calc(50%-0.125rem)]'
        />
        <Input
          type='search'
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          aria-label={t('Search documentation')}
          placeholder={t('Search documentation')}
          className='bg-background h-9 pl-8'
        />
      </label>

      {props.query.trim() ? (
        <div className='flex flex-col gap-1 px-2 pb-4'>
          <p className='text-muted-foreground px-2 py-1 text-xs font-medium'>
            {hits.length > 0 ? t('Search results') : t('No matching docs')}
          </p>
          {hits.map((hit) => {
            const doc = guideDocs.find((item) => item.slug === hit.slug)
            if (!doc) return null
            return (
              <GuideLink
                key={hit.id}
                doc={doc}
                hash={hit.sectionId}
                onClick={props.onNavigate}
                className='hover:bg-muted focus-visible:ring-ring rounded-lg px-2 py-2 outline-none focus-visible:ring-2'
              >
                <strong className='block text-sm font-medium'>
                  {hit.title}
                </strong>
                <span className='text-muted-foreground mt-0.5 block text-xs'>
                  {hit.snippet}
                </span>
              </GuideLink>
            )
          })}
        </div>
      ) : (
        <div className='flex flex-col gap-5 px-2 pb-5'>
          {GROUPS.map((group) => {
            const docs = guideDocs.filter((doc) => doc.group === group.id)
            return (
              <div key={group.id}>
                <p className='text-muted-foreground mb-1 px-2 text-[0.68rem] font-medium tracking-[0.12em] uppercase'>
                  {t(group.label)}
                </p>
                <div className='flex flex-col gap-0.5'>
                  {docs.map((doc) => {
                    const active = doc.slug === props.activeSlug
                    return (
                      <GuideLink
                        key={doc.slug}
                        doc={doc}
                        onClick={props.onNavigate}
                        className={cn(
                          'hover:bg-muted focus-visible:ring-ring rounded-lg px-2 py-2 text-sm outline-none focus-visible:ring-2',
                          active && 'bg-primary/10 text-primary font-medium'
                        )}
                      >
                        <span aria-current={active ? 'page' : undefined}>
                          {t(doc.title)}
                        </span>
                      </GuideLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
