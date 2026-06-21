/*
Copyright (C) 2026 DeepRouter

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
*/
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Loader2, RefreshCw } from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { cn } from '@/lib/utils'
import { DOC_CATEGORIES, DOC_TITLES, GUIDE_SLUG } from './catalog'
import { DocMarkdown } from './components/doc-markdown'
import { useDocContent } from './use-doc-content'

/** Left navigation shared by the index and every doc page. */
function DocsSidebar({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav className='space-y-6 text-sm'>
      <Link
        to='/resources'
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 font-medium',
          !activeSlug
            ? 'bg-info/10 text-info'
            : 'text-muted-foreground hover:bg-info/5'
        )}
      >
        <BookOpen className='size-4' />
        Start here
      </Link>
      {DOC_CATEGORIES.map((cat) => (
        <div key={cat.id} className='space-y-1'>
          <p className='text-muted-foreground/70 px-3 text-xs font-semibold uppercase tracking-wider'>
            {cat.title}
          </p>
          {cat.entries.map((entry) => (
            <Link
              key={entry.slug}
              to='/resources/$slug'
              params={{ slug: entry.slug }}
              className={cn(
                'block rounded-md px-3 py-1.5',
                activeSlug === entry.slug
                  ? 'bg-info/10 text-info font-medium'
                  : 'text-muted-foreground hover:bg-info/5'
              )}
            >
              {entry.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

function DocsShell({
  activeSlug,
  children,
}: {
  activeSlug?: string
  children: React.ReactNode
}) {
  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-7xl px-4 py-10 md:px-6'>
        <div className='flex flex-col gap-10 md:flex-row'>
          <aside className='md:w-64 md:shrink-0'>
            <div className='md:sticky md:top-24'>
              <DocsSidebar activeSlug={activeSlug} />
            </div>
          </aside>
          <main className='min-w-0 flex-1'>{children}</main>
        </div>
      </div>
      <Footer />
    </PublicLayout>
  )
}

function LoadingState() {
  return (
    <div className='text-muted-foreground flex items-center gap-2 py-20'>
      <Loader2 className='size-4 animate-spin' />
      Loading…
    </div>
  )
}

/** `/resources` — master guide hero + a grid of every tool. */
export function DocsIndexPage() {
  const guide = useDocContent(GUIDE_SLUG)

  return (
    <DocsShell>
      <div className='mb-12'>
        <p className='text-primary mb-2 text-sm font-semibold'>Integrations</p>
        <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
          Connect your tools to DeepRouter
        </h1>
        <p className='text-muted-foreground mt-3 max-w-2xl text-base'>
          Keep the tool you already use — just point it at DeepRouter by changing
          two things: a base URL and an API key. Pick your tool below, or read the
          complete guide first.
        </p>
      </div>

      {DOC_CATEGORIES.map((cat) => (
        <section key={cat.id} className='mb-10'>
          <h2 className='mb-4 text-lg font-semibold'>{cat.title}</h2>
          <div className='grid gap-3 sm:grid-cols-2'>
            {cat.entries.map((entry) => (
              <Link
                key={entry.slug}
                to='/resources/$slug'
                params={{ slug: entry.slug }}
                className='group border-border bg-card hover:border-info/50 hover:bg-info/5 rounded-xl border p-4 transition-colors'
              >
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>{entry.title}</span>
                  <ArrowRight className='text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5' />
                </div>
                <p className='text-muted-foreground mt-1 text-sm'>{entry.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className='mt-14 border-t pt-10'>
        <h2 className='mb-6 text-2xl font-semibold'>The complete guide</h2>
        {guide.status === 'loading' && <LoadingState />}
        {guide.status === 'ready' && <DocMarkdown>{guide.content}</DocMarkdown>}
        {guide.status === 'error' && (
          <p className='text-muted-foreground'>Guide content is unavailable.</p>
        )}
      </section>
    </DocsShell>
  )
}

/** `/resources/$slug` — a single tool guide. */
export function DocPage({ slug }: { slug: string }) {
  const doc = useDocContent(slug)
  const title = DOC_TITLES[slug] ?? slug

  return (
    <DocsShell activeSlug={slug}>
      <Link
        to='/resources'
        className='text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm'
      >
        ← All integrations
      </Link>
      {doc.status === 'loading' && <LoadingState />}
      {doc.status === 'ready' && <DocMarkdown>{doc.content}</DocMarkdown>}
      {doc.status === 'error' && (
        <div className='py-16'>
          <h1 className='text-2xl font-semibold'>{title}</h1>
          <p className='text-muted-foreground mt-2'>
            This guide could not be loaded
            {doc.reason ? ` (${doc.reason})` : ''}. If you just updated the app,
            this is usually a stale cache — retry, or hard-refresh the page.
          </p>
          <div className='mt-4 flex items-center gap-3'>
            <button
              type='button'
              onClick={doc.reload}
              className='bg-info/10 text-info hover:bg-info/20 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
            >
              <RefreshCw className='size-4' />
              Retry
            </button>
            <Link
              to='/resources'
              className='text-muted-foreground hover:text-foreground text-sm'
            >
              Back to all integrations
            </Link>
          </div>
        </div>
      )}
    </DocsShell>
  )
}
