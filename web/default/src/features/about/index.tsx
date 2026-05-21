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
import {
  Box,
  Cloud,
  KeyRound,
  Layers,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { publicPortalCardClassName } from '@/lib/ops-ui-styles'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { getAboutContent } from './api'

const CAPABILITY_CARDS = [
  {
    icon: Layers,
    titleKey: 'Unified model resource access',
    descKey:
      'Connect and govern multiple model services through one operations console.',
  },
  {
    icon: KeyRound,
    titleKey: 'Quota-unit resource operations',
    descKey:
      'Manage quota-unit balance, recharge, settlement, and consumption in one place.',
  },
  {
    icon: Users,
    titleKey: 'Multi-tenant account management',
    descKey:
      'Coordinate tenant groups, accounts, roles, and access policies.',
  },
  {
    icon: ShieldCheck,
    titleKey: 'Call audit and task tracking',
    descKey:
      'Track service calls, quota-unit consumption details, and operational records.',
  },
  {
    icon: Cloud,
    titleKey: 'Private and edge deployment',
    descKey:
      'Works with Xingze AI edge appliances for cloud, private, and edge-side deployment.',
  },
] as const

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function AboutPortalHero() {
  const { t } = useTranslation()

  return (
    <header className='mx-auto max-w-3xl space-y-4 pt-8 text-center sm:pt-12'>
      <h1 className='text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.15] font-bold tracking-tight text-slate-50'>
        {t('Yunhe Xingze Token Operations Center')}
      </h1>
      <p className='text-sm leading-relaxed text-slate-300 sm:text-base'>
        {t(
          'An integrated model-service access and quota-unit operations platform for government and enterprise customers — unified governance, auditable usage, and controlled resource delivery.'
        )}
      </p>
    </header>
  )
}

function EmptyAboutState() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='relative mx-auto w-full max-w-5xl px-4 pt-16 pb-16 sm:px-6 sm:pt-20'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-30'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 15% 10%, oklch(0.55 0.14 195 / 70%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 85% 20%, oklch(0.5 0.12 280 / 55%) 0%, transparent 70%)',
          ].join(', '),
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 30%, transparent 100%)',
        }}
      />
      <div className='relative space-y-10'>
        <AboutPortalHero />
        <div className='grid gap-4 sm:grid-cols-2'>
          {CAPABILITY_CARDS.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className={cn(
                publicPortalCardClassName,
                'p-5 transition-colors hover:border-cyan-400/25'
              )}
            >
              <span className='mb-3 inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-cyan-500/15 text-cyan-200'>
                <Icon className='size-5' aria-hidden />
              </span>
              <p className='font-semibold text-slate-100'>{t(titleKey)}</p>
              <p className='mt-2 text-sm leading-relaxed text-slate-400'>
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
        <div
          className={cn(
            publicPortalCardClassName,
            'flex items-start gap-4 p-5 sm:p-6'
          )}
        >
          <span className='inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-violet-500/15 text-violet-200'>
            <Box className='size-5' aria-hidden />
          </span>
          <p className='text-sm leading-relaxed text-slate-300'>
            {t(
              'Deploy in the cloud, in a private environment, or alongside Xingze AI edge appliances — one operations experience across deployment models.'
            )}
          </p>
        </div>
        <p className='text-center text-sm text-slate-500'>
          &copy; {currentYear} {t('Yunhe Xingze Token Operations Center')}.{' '}
          {t('All rights reserved.')}
        </p>
      </div>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: getAboutContent,
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <PublicLayout portalShell>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 px-4 py-16 sm:px-6'>
          <Skeleton className='h-8 w-[45%] bg-white/10' />
          <Skeleton className='h-4 w-full bg-white/10' />
          <Skeleton className='h-4 w-[90%] bg-white/10' />
          <Skeleton className='h-4 w-[80%] bg-white/10' />
        </div>
      </PublicLayout>
    )
  }

  if (!hasContent) {
    return (
      <PublicLayout showMainContainer={false} portalShell>
        <EmptyAboutState />
      </PublicLayout>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false} portalShell>
        <iframe
          src={rawContent}
          className='h-[calc(100vh-3.5rem)] w-full border-0 bg-slate-950'
          title={t('About Center')}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout portalShell>
      <div className='relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12'>
        <AboutPortalHero />
        <div
          className={cn(
            publicPortalCardClassName,
            'mt-8 p-6 sm:p-8',
            isHtml ? 'prose prose-invert max-w-none text-slate-300' : ''
          )}
        >
          {isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: rawContent }} />
          ) : (
            <Markdown className='prose-invert max-w-none text-slate-300'>
              {rawContent}
            </Markdown>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
