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
  BookOpen01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout/components/public-layout'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type DocsPageId =
  | 'introduction'
  | 'payment'
  | 'model-pricing'
  | 'cc-switch'
  | 'codex'
  | 'claude-code'
  | 'openclaw'
  | 'hermes'
  | 'opencode'
  | 'gemini'
  | 'api-integration'

type DocsHref =
  | '/docs'
  | '/docs/payment'
  | '/docs/model-pricing'
  | '/docs/tools/cc-switch'
  | '/docs/tools/codex'
  | '/docs/tools/claude-code'
  | '/docs/tools/openclaw'
  | '/docs/tools/hermes'
  | '/docs/tools/opencode'
  | '/docs/tools/gemini'
  | '/docs/api/integration'

export type DocsTocItem = {
  id: string
  label: string
}

type DocsShellProps = {
  pageId: DocsPageId
  title: string
  description: string
  toc: DocsTocItem[]
  children: React.ReactNode
}

type DocsNavigationItem = {
  id: DocsPageId
  label: string
  href: DocsHref
}

type DocsNavigationGroup = {
  label: string
  items: DocsNavigationItem[]
}

function DocsNavigation(props: {
  currentPageId: DocsPageId
  groups: DocsNavigationGroup[]
  ariaLabel: string
}) {
  return (
    <nav aria-label={props.ariaLabel} className='flex flex-col gap-5'>
      {props.groups.map((group) => (
        <div key={group.label}>
          <p className='text-muted-foreground mb-1.5 px-3 text-xs font-semibold'>
            {group.label}
          </p>
          <div className='flex flex-col gap-1'>
            {group.items.map((item) => {
              const isActive = item.id === props.currentPageId
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function DocsMobileNavigation(props: {
  currentPageId: DocsPageId
  groups: DocsNavigationGroup[]
  ariaLabel: string
}) {
  const navigate = useNavigate()
  const currentItem = props.groups
    .flatMap((group) => group.items)
    .find((item) => item.id === props.currentPageId)

  return (
    <div className='mx-auto flex w-full max-w-[1400px] items-center gap-2'>
      <HugeiconsIcon
        icon={BookOpen01Icon}
        className='text-muted-foreground size-4 shrink-0'
        aria-hidden='true'
      />
      <select
        value={currentItem?.href ?? '/docs'}
        aria-label={props.ariaLabel}
        onChange={(event) => {
          void navigate({ to: event.target.value as DocsHref })
        }}
        className='border-border bg-background text-foreground focus-visible:ring-ring h-9 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-2'
      >
        {props.groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={item.href}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

export function DocsShell(props: DocsShellProps) {
  const { t } = useTranslation()
  const navigationGroups: DocsNavigationGroup[] = [
    {
      label: t('Overview'),
      items: [
        {
          id: 'introduction',
          label: t('Gateway introduction'),
          href: '/docs',
        },
        {
          id: 'payment',
          label: t('Billing and payment'),
          href: '/docs/payment',
        },
        {
          id: 'model-pricing',
          label: t('Model pricing and consumption'),
          href: '/docs/model-pricing',
        },
      ],
    },
    {
      label: t('Tool access guides'),
      items: [
        {
          id: 'cc-switch',
          label: t('CC Switch one-click import'),
          href: '/docs/tools/cc-switch',
        },
        { id: 'codex', label: 'Codex', href: '/docs/tools/codex' },
        {
          id: 'claude-code',
          label: 'Claude Code',
          href: '/docs/tools/claude-code',
        },
        { id: 'openclaw', label: 'OpenClaw', href: '/docs/tools/openclaw' },
        { id: 'hermes', label: 'Hermes', href: '/docs/tools/hermes' },
        { id: 'opencode', label: 'OpenCode', href: '/docs/tools/opencode' },
        { id: 'gemini', label: 'Gemini', href: '/docs/tools/gemini' },
      ],
    },
    {
      label: t('General API access'),
      items: [
        {
          id: 'api-integration',
          label: t('API integration guide'),
          href: '/docs/api/integration',
        },
      ],
    },
  ]
  const navigation = navigationGroups.flatMap((group) => group.items)
  const currentIndex = navigation.findIndex((item) => item.id === props.pageId)
  const previous = currentIndex > 0 ? navigation[currentIndex - 1] : undefined
  const next =
    currentIndex < navigation.length - 1
      ? navigation[currentIndex + 1]
      : undefined

  return (
    <PublicLayout showMainContainer={false}>
      <div className='border-border bg-background/95 sticky top-16 z-30 mt-16 border-y px-4 py-2 backdrop-blur md:hidden'>
        <DocsMobileNavigation
          currentPageId={props.pageId}
          groups={navigationGroups}
          ariaLabel={t('Documentation')}
        />
      </div>

      <div className='mx-auto grid w-full max-w-[1400px] grid-cols-1 px-4 md:grid-cols-[232px_minmax(0,1fr)] md:gap-10 md:px-6 md:pt-16 xl:grid-cols-[232px_minmax(0,760px)_190px] xl:gap-12'>
        <aside className='hidden md:block'>
          <div className='border-border bg-card sticky top-24 mt-8 rounded-lg border p-3'>
            <div className='text-muted-foreground mb-3 flex items-center gap-2 px-2 text-xs font-semibold'>
              <HugeiconsIcon
                icon={BookOpen01Icon}
                className='size-4'
                aria-hidden='true'
              />
              {t('Documentation')}
            </div>
            <DocsNavigation
              currentPageId={props.pageId}
              groups={navigationGroups}
              ariaLabel={t('Documentation')}
            />
          </div>
        </aside>

        <main className='min-w-0 py-8 md:py-12'>
          <nav
            aria-label={t('Breadcrumb')}
            className='text-muted-foreground mb-8 flex items-center gap-2 text-sm'
          >
            <Link to='/' className='hover:text-foreground transition-colors'>
              {t('Home')}
            </Link>
            <span aria-hidden='true'>/</span>
            <Link
              to='/docs'
              className='hover:text-foreground transition-colors'
            >
              {t('Documentation')}
            </Link>
            {props.pageId !== 'introduction' && (
              <>
                <span aria-hidden='true'>/</span>
                <span className='text-foreground truncate'>{props.title}</span>
              </>
            )}
          </nav>

          <header>
            <h1 className='text-3xl font-semibold'>{props.title}</h1>
            <p className='text-muted-foreground mt-3 max-w-2xl text-base leading-7'>
              {props.description}
            </p>
          </header>

          <Separator className='my-8' />

          <article className='flex flex-col gap-12'>{props.children}</article>

          <Separator className='mt-12 mb-6' />
          <nav
            aria-label={t('Document pagination')}
            className='grid min-h-16 grid-cols-2 gap-4'
          >
            <div>
              {previous && (
                <Link
                  to={previous.href}
                  className='group text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors'
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    className='size-4 transition-transform group-hover:-translate-x-0.5'
                    aria-hidden='true'
                  />
                  <span>
                    <span className='block text-xs'>{t('Previous')}</span>
                    <span className='text-foreground font-medium'>
                      {previous.label}
                    </span>
                  </span>
                </Link>
              )}
            </div>
            <div className='text-right'>
              {next && (
                <Link
                  to={next.href}
                  className='group text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-left text-sm transition-colors'
                >
                  <span>
                    <span className='block text-xs'>{t('Next')}</span>
                    <span className='text-foreground font-medium'>
                      {next.label}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className='size-4 transition-transform group-hover:translate-x-0.5'
                    aria-hidden='true'
                  />
                </Link>
              )}
            </div>
          </nav>
        </main>

        <aside className='hidden xl:block'>
          <nav
            aria-label={t('On this page')}
            className='border-border sticky top-24 mt-12 border-l pl-5'
          >
            <p className='text-muted-foreground mb-3 text-xs font-semibold'>
              {t('On this page')}
            </p>
            <div className='flex flex-col gap-2.5'>
              {props.toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </aside>
      </div>
    </PublicLayout>
  )
}
