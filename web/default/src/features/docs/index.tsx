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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileQuestion, Menu } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledLanguage } from 'shiki/bundle/web'

import { useSeo } from '@/hooks/use-page-seo'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildIntegrationSample,
  integrationPath,
  type SampleLanguage,
} from '@/features/integrations/sample-builder'
import { getIntegrationProfiles } from '@/features/pricing/api'
import type { IntegrationProfile } from '@/features/pricing/types'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import {
  GLOBAL_DOCS,
  PROFILE_NOTES,
  REPRESENTATIVE_MODEL,
  type DocsPage as GlobalDocsPage,
} from './content'

const LANGUAGES: Array<{
  value: SampleLanguage
  label: string
  syntax: BundledLanguage
}> = [
  { value: 'curl', label: 'cURL', syntax: 'bash' },
  { value: 'python', label: 'Python', syntax: 'python' },
  { value: 'typescript', label: 'TypeScript', syntax: 'typescript' },
  { value: 'javascript', label: 'JavaScript', syntax: 'javascript' },
]

function DocsNavigation(props: {
  slug: string
  profiles: IntegrationProfile[]
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const protocols = useMemo(() => {
    const groups = new Map<string, IntegrationProfile[]>()
    for (const profile of props.profiles) {
      groups.set(profile.protocol, [
        ...(groups.get(profile.protocol) ?? []),
        profile,
      ])
    }
    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    )
  }, [props.profiles])
  const linkClass = (slug: string) =>
    cn(
      'block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
      slug === props.slug && 'bg-muted text-foreground font-medium'
    )

  return (
    <nav aria-label={t('API Docs')} className='space-y-5'>
      <div>
        <p className='text-muted-foreground mb-1 px-3 text-xs font-semibold uppercase'>
          {t('Getting started')}
        </p>
        <Link
          to='/docs/$slug'
          params={{ slug: 'getting-started' }}
          className={linkClass('getting-started')}
          onClick={props.onNavigate}
        >
          {t('Getting started')}
        </Link>
      </div>
      <div>
        <p className='text-muted-foreground mb-1 px-3 text-xs font-semibold uppercase'>
          {t('Protocols')}
        </p>
        {protocols.map(([protocol, profiles]) => (
          <div key={protocol} className='mb-3'>
            <p className='px-3 py-1 text-xs font-medium capitalize'>
              {protocol}
            </p>
            {profiles.map((profile) => (
              <Link
                key={profile.id}
                to='/docs/$slug'
                params={{ slug: profile.docs_slug }}
                className={linkClass(profile.docs_slug)}
                onClick={props.onNavigate}
              >
                {t(profile.name_key)}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div>
        <p className='text-muted-foreground mb-1 px-3 text-xs font-semibold uppercase'>
          {t('Platform')}
        </p>
        {GLOBAL_DOCS.slice(1).map((page) => (
          <Link
            key={page.slug}
            to='/docs/$slug'
            params={{ slug: page.slug }}
            className={linkClass(page.slug)}
            onClick={props.onNavigate}
          >
            {t(page.title)}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function GlobalContent(props: { page: GlobalDocsPage; baseUrl: string }) {
  const { t } = useTranslation()
  return (
    <>
      {props.page.slug === 'getting-started' && (
        <div className='bg-muted mt-6 rounded-lg border p-4 text-sm'>
          <p className='text-muted-foreground'>{t('Production base URL')}</p>
          <code>{props.baseUrl}</code>
          <div className='mt-3 flex flex-wrap gap-4'>
            <Link to='/keys' className='text-primary hover:underline'>
              {t('Create API key')}
            </Link>
            <Link to='/pricing' className='text-primary hover:underline'>
              {t('Browse Model Hub')}
            </Link>
          </div>
        </div>
      )}
      {props.page.sections.map((section) => (
        <section key={section.title} className='mt-10 space-y-4'>
          <h2 className='text-xl font-semibold'>{t(section.title)}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className='text-muted-foreground leading-7'>
              {t(paragraph)}
            </p>
          ))}
          {section.items && (
            <ol className='text-muted-foreground list-decimal space-y-2 pl-6 leading-7'>
              {section.items.map((item) => (
                <li key={item}>{t(item)}</li>
              ))}
            </ol>
          )}
          {section.code && (
            <CodeBlock
              code={section.code.replace('$BOXAI_BASE_URL', props.baseUrl)}
              language={section.codeLanguage ?? 'text'}
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          )}
        </section>
      ))}
    </>
  )
}

function ProfileContent(props: {
  profile: IntegrationProfile
  baseUrl: string
}) {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<SampleLanguage>('curl')
  const languageMeta = LANGUAGES.find((item) => item.value === language) ?? {
    value: 'curl' as const,
    label: 'cURL',
    syntax: 'bash' as const,
  }
  const sample = buildIntegrationSample(
    props.profile,
    REPRESENTATIVE_MODEL,
    language,
    props.baseUrl
  )
  const authHeader =
    props.profile.auth_scheme === 'x-api-key'
      ? 'x-api-key'
      : 'Authorization: Bearer'

  return (
    <>
      <p className='text-muted-foreground mt-3'>
        {t(
          'Use this gateway integration profile with an exact model ID from Model Hub.'
        )}
      </p>
      <div className='mt-6 rounded-lg border p-4 text-sm'>
        <p>
          {t(
            'These examples call the BoxAI gateway, not an upstream provider. Model availability depends on your group; check Model Hub before integrating.'
          )}
        </p>
        <Link
          to='/pricing'
          className='text-primary mt-2 inline-block hover:underline'
        >
          {t('Browse Model Hub')}
        </Link>
      </div>
      <dl className='mt-6 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2'>
        {[
          [t('Method'), props.profile.method],
          [
            t('Gateway route'),
            integrationPath(props.profile, REPRESENTATIVE_MODEL),
          ],
          [t('Authentication header'), authHeader],
          [t('Content type'), props.profile.content_type],
          [
            t('Streaming support'),
            props.profile.streaming ? t('Supported') : t('Not supported'),
          ],
          [t('Model placeholder'), REPRESENTATIVE_MODEL],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='mt-1 font-mono text-xs'>{value}</dd>
          </div>
        ))}
      </dl>
      <section className='mt-8 space-y-3'>
        <h2 className='text-xl font-semibold'>{t('Protocol notes')}</h2>
        {(PROFILE_NOTES[props.profile.sample_kind] ?? []).map((note) => (
          <p key={note} className='text-muted-foreground'>
            {t(note)}
          </p>
        ))}
      </section>
      <div className='mt-8'>
        <Tabs
          value={language}
          onValueChange={(value) => setLanguage(value as SampleLanguage)}
        >
          <TabsList className='mb-3 flex-wrap'>
            {LANGUAGES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <CodeBlock code={sample} language={languageMeta.syntax}>
          <CodeBlockCopyButton />
        </CodeBlock>
      </div>
    </>
  )
}

export function DocsPage(props: { slug: string }) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [mobileOpen, setMobileOpen] = useState(false)
  const profilesQuery = useQuery({
    queryKey: ['integration-profiles'],
    queryFn: getIntegrationProfiles,
    staleTime: 5 * 60 * 1000,
  })
  const profiles = profilesQuery.data ?? []
  const profile = profiles.find((item) => item.docs_slug === props.slug)
  const globalPage = GLOBAL_DOCS.find((item) => item.slug === props.slug)
  const statusRecord = status as Record<string, unknown> | null
  const baseUrl =
    (typeof statusRecord?.server_address === 'string' &&
      statusRecord.server_address.replace(/\/$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const title = profile?.name_key ?? globalPage?.title
  const waitingForProfile = !globalPage && profilesQuery.isPending
  const profileUnavailable = !globalPage && profilesQuery.isError

  const seoTitle = title ? t(title) : t('API Docs')
  let seoDescription = t('API documentation for the unified AI gateway.')
  if (globalPage) {
    seoDescription = t(globalPage.summary)
  } else if (profile) {
    seoDescription = t(
      'API documentation for {{name}} on the unified AI gateway.',
      { name: t(title || 'API') }
    )
  }

  useSeo(
    useMemo(
      () => ({
        title: seoTitle,
        description: seoDescription,
      }),
      [seoTitle, seoDescription]
    )
  )

  return (
    <PublicLayout>
      <div className='mx-auto max-w-7xl px-4 py-6'>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant='outline'
                className='md:hidden'
                aria-label={t('Open docs navigation')}
              />
            }
          >
            <Menu className='size-4' /> {t('Browse documentation')}
          </SheetTrigger>
          <SheetContent side='left'>
            <SheetHeader>
              <SheetTitle>{t('API Docs')}</SheetTitle>
              <SheetDescription>{t('Browse documentation')}</SheetDescription>
            </SheetHeader>
            <div className='overflow-y-auto px-2 pb-6'>
              <DocsNavigation
                slug={props.slug}
                profiles={profiles}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
        <div className='mt-4 grid gap-10 md:mt-0 md:grid-cols-[240px_minmax(0,1fr)]'>
          <aside className='sticky top-20 hidden max-h-[calc(100vh-6rem)] self-start overflow-y-auto md:block'>
            <DocsNavigation slug={props.slug} profiles={profiles} />
          </aside>
          <main className='max-w-3xl min-w-0 pb-20'>
            {waitingForProfile && (
              <div className='space-y-4'>
                <Skeleton className='h-9 w-2/3' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-11/12' />
                <Skeleton className='h-64 w-full rounded-xl' />
              </div>
            )}
            {profileUnavailable && (
              <ErrorState
                className='border border-dashed'
                title={t('Loading failed')}
              />
            )}
            {!waitingForProfile && !profileUnavailable && !title && (
              <EmptyState
                icon={FileQuestion}
                title={t('Documentation page not found')}
                description={t(
                  'The requested documentation page does not exist or is no longer available.'
                )}
                action={
                  <Link
                    to='/docs/$slug'
                    params={{ slug: 'getting-started' }}
                    className='text-primary inline-block hover:underline'
                  >
                    {t('Go to getting started')}
                  </Link>
                }
              />
            )}
            {!waitingForProfile && !profileUnavailable && title && (
              <>
                <h1 className='text-3xl font-bold tracking-tight'>
                  {t(title)}
                </h1>
                {profile ? (
                  <ProfileContent profile={profile} baseUrl={baseUrl} />
                ) : (
                  globalPage && (
                    <>
                      <p className='text-muted-foreground mt-3 text-lg'>
                        {t(globalPage.summary)}
                      </p>
                      <GlobalContent page={globalPage} baseUrl={baseUrl} />
                    </>
                  )
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
