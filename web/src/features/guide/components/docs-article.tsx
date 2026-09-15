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
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { getGuideBlockKey, getGuideNeighbors } from '../catalog'
import { useGuideEnvironment } from '../hooks/use-guide-environment'
import type { GuideBlock, GuideDoc, GuidePlatform, GuideSearch } from '../types'
import { DocBlock } from './doc-block'
import { GuideEnvironment } from './guide-environment'
import { MobileDocsNav } from './mobile-docs-nav'

const PLATFORM_LABELS: Record<GuidePlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  vscode: 'VS Code',
  jetbrains: 'JetBrains',
}

type DocsArticleProps = {
  doc: GuideDoc
  search: GuideSearch
  onSearchChange: (next: Partial<GuideSearch>) => void
  mobileQuery: string
  onMobileQueryChange: (query: string) => void
}

function collectPlatforms(block: GuideBlock, platforms: Set<GuidePlatform>) {
  if (block.type !== 'platform') return
  for (const platform of Object.keys(block.platforms) as GuidePlatform[]) {
    platforms.add(platform)
  }
}

function ArticleLink(props: { doc: GuideDoc; direction: 'previous' | 'next' }) {
  const { t } = useTranslation()
  const content = (
    <>
      {props.direction === 'previous' ? (
        <HugeiconsIcon icon={ArrowLeft01Icon} data-icon='inline-start' />
      ) : null}
      <span>
        <small className='text-muted-foreground block text-[0.68rem] uppercase'>
          {t(props.direction === 'previous' ? 'Previous' : 'Next')}
        </small>
        {t(props.doc.title)}
      </span>
      {props.direction === 'next' ? (
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
      ) : null}
    </>
  )
  const className = cn(
    'border-border hover:bg-muted focus-visible:ring-ring flex min-h-16 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2',
    props.direction === 'next' && 'justify-end text-right'
  )

  if (props.doc.slug === 'quick-start') {
    return (
      <Link to='/guide' className={className}>
        {content}
      </Link>
    )
  }
  return (
    <Link
      to='/guide/$slug'
      params={{ slug: props.doc.slug }}
      className={className}
    >
      {content}
    </Link>
  )
}

export function DocsArticle(props: DocsArticleProps) {
  const { t } = useTranslation()
  const supportedPlatforms = useMemo(() => {
    const platforms = new Set<GuidePlatform>()
    for (const section of props.doc.sections) {
      for (const block of section.blocks) collectPlatforms(block, platforms)
    }
    return [...platforms]
  }, [props.doc])
  const fallbackPlatform = supportedPlatforms.includes('macos')
    ? 'macos'
    : (supportedPlatforms[0] ?? 'macos')
  const platform = supportedPlatforms.includes(props.search.platform ?? 'macos')
    ? (props.search.platform ?? fallbackPlatform)
    : fallbackPlatform
  const environment = useGuideEnvironment(
    props.doc.audience,
    {
      model: props.search.model,
      group: props.search.group,
      platform,
    },
    (selection) => props.onSearchChange(selection)
  )
  const [activeSection, setActiveSection] = useState(
    props.doc.sections[0]?.id ?? ''
  )
  const neighbors = getGuideNeighbors(props.doc.slug)

  useEffect(() => {
    setActiveSection(props.doc.sections[0]?.id ?? '')
    if (typeof IntersectionObserver === 'undefined') return
    const sections = document.querySelectorAll<HTMLElement>(
      '[data-guide-section="true"]'
    )
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [props.doc])

  return (
    <>
      <main className='min-w-0 px-4 py-5 sm:px-7 lg:px-10 lg:py-8 xl:px-14'>
        <div className='mx-auto max-w-[72ch]'>
          <div className='mb-6 flex items-center justify-between gap-3 lg:hidden'>
            <MobileDocsNav
              activeSlug={props.doc.slug}
              query={props.mobileQuery}
              onQueryChange={props.onMobileQueryChange}
            />
            <Badge variant='outline'>{t('Developer docs')}</Badge>
          </div>

          <header className='mb-7'>
            <p className='text-primary mb-2 text-xs font-medium tracking-[0.12em] uppercase'>
              {t('Developer docs')}
            </p>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <h1 className='font-display text-foreground text-3xl font-medium tracking-tight text-balance sm:text-4xl'>
                {t(props.doc.title)}
              </h1>
              <Badge variant='secondary'>
                <HugeiconsIcon icon={Clock01Icon} data-icon='inline-start' />
                {t('{{count}} min read', { count: props.doc.readingMinutes })}
              </Badge>
            </div>
            <p className='text-muted-foreground mt-3 text-base leading-7 text-pretty'>
              {t(props.doc.summary)}
            </p>
          </header>

          <GuideEnvironment environment={environment} />

          {supportedPlatforms.length > 0 ? (
            <Tabs
              value={platform}
              onValueChange={(value) =>
                props.onSearchChange({ platform: value as GuidePlatform })
              }
              className='mt-8'
            >
              <TabsList variant='line' aria-label={t('Platform')}>
                {supportedPlatforms.map((item) => (
                  <TabsTrigger key={item} value={item}>
                    {t(PLATFORM_LABELS[item])}
                  </TabsTrigger>
                ))}
              </TabsList>
              {supportedPlatforms.map((item) => (
                <TabsContent key={item} value={item} className='sr-only'>
                  {t('{{platform}} instructions selected', {
                    platform: t(PLATFORM_LABELS[item]),
                  })}
                </TabsContent>
              ))}
            </Tabs>
          ) : null}

          <div className='mt-8'>
            {props.doc.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                data-guide-section='true'
                className='scroll-mt-6 py-3 first:pt-0'
              >
                {index > 0 ? <Separator className='mb-8' /> : null}
                <h2 className='font-display text-foreground text-2xl font-medium tracking-tight'>
                  {t(section.title)}
                </h2>
                {section.blocks.map((block) => (
                  <DocBlock
                    key={`${section.id}-${getGuideBlockKey(block)}`}
                    block={block}
                    runtime={environment.runtime}
                  />
                ))}
              </section>
            ))}
          </div>

          <nav
            aria-label={t('Article navigation')}
            className='mt-10 grid gap-3 sm:grid-cols-2'
          >
            {neighbors.previous ? (
              <ArticleLink doc={neighbors.previous} direction='previous' />
            ) : (
              <span />
            )}
            {neighbors.next ? (
              <ArticleLink doc={neighbors.next} direction='next' />
            ) : null}
          </nav>
        </div>
      </main>

      <aside
        data-testid='guide-toc'
        className='border-border sticky top-0 hidden h-[calc(100svh-var(--app-header-height,0px))] border-l px-4 py-8 xl:block'
      >
        <p className='text-muted-foreground mb-3 text-[0.68rem] font-medium tracking-[0.12em] uppercase'>
          {t('On this page')}
        </p>
        <nav aria-label={t('On this page')} className='flex flex-col gap-1'>
          {props.doc.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                'hover:text-foreground border-l-2 border-transparent px-3 py-1.5 text-xs leading-5',
                activeSection === section.id
                  ? 'border-primary text-foreground font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {t(section.title)}
            </a>
          ))}
        </nav>
      </aside>
    </>
  )
}
