/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  ArrowDownToLine,
  CheckCircle2,
  FileOutput,
  Files,
  Link2,
  LockKeyhole,
  ShieldCheck,
  SquareTerminal,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

type DesktopPlatform = 'macOS' | 'Windows' | 'Linux'

const FEATURES = [
  {
    title: 'Work with local files',
    description:
      'Read, organize, and transform files on your computer without uploading your whole workspace.',
    icon: Files,
  },
  {
    title: 'Use the shell',
    description:
      'Run commands and development tools locally, with clear visibility into every action.',
    icon: SquareTerminal,
  },
  {
    title: 'Create real deliverables',
    description:
      'Turn a request into documents, spreadsheets, presentations, code, and other ready-to-use outputs.',
    icon: FileOutput,
  },
  {
    title: 'Connect your tools',
    description:
      'Bring context from supported services into one focused workspace through secure connectors.',
    icon: Link2,
  },
] as const

function detectPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null
  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()
  if (platform.includes('mac')) return 'macOS'
  if (platform.includes('win')) return 'Windows'
  if (platform.includes('linux')) return 'Linux'
  return null
}

export function AgentsView() {
  const { t } = useTranslation()
  const { status, loading } = useStatus()
  const platform = detectPlatform()
  const downloadUrl = status?.desktop_download_url?.trim()
  const minimumVersion = status?.desktop_min_version?.trim()

  let downloadLabel = t('Download BoxAI Desktop')
  if (platform) downloadLabel = t('Download for {{platform}}', { platform })
  if (loading) downloadLabel = t('Checking download availability')
  if (!loading && !downloadUrl) downloadLabel = t('Desktop app coming soon')

  return (
    <div className='playground-discover-hero min-h-svh px-3 pt-20 pb-10 sm:px-5 sm:pt-24 md:px-8'>
      <PageTransition className='mx-auto max-w-5xl space-y-5 md:space-y-8'>
        <section className='border-border bg-card relative overflow-hidden rounded-2xl border px-5 py-8 shadow-sm sm:px-8 sm:py-10 md:px-12 md:py-14'>
          <div
            aria-hidden='true'
            className='from-primary/20 via-primary/5 absolute -top-32 -right-24 size-80 rounded-full bg-radial to-transparent blur-2xl'
          />
          <div className='relative max-w-3xl'>
            <div className='bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium'>
              <ShieldCheck className='size-3.5' aria-hidden='true' />
              {t('BoxAI Desktop')}
            </div>
            <h1 className='text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl'>
              {t('An AI agent that works where your work lives')}
            </h1>
            <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-6 text-pretty sm:text-base sm:leading-7'>
              {t(
                'BoxAI Desktop combines powerful models with the files, tools, and services on your computer—so you can move from an idea to a finished deliverable.'
              )}
            </p>
            <div className='mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
              {downloadUrl ? (
                <Button
                  size='lg'
                  render={
                    <a
                      href={downloadUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  }
                >
                  <ArrowDownToLine aria-hidden='true' />
                  {downloadLabel}
                </Button>
              ) : (
                <Button size='lg' disabled aria-disabled='true'>
                  <ArrowDownToLine aria-hidden='true' />
                  {downloadLabel}
                </Button>
              )}
              <p className='text-muted-foreground text-xs'>
                {minimumVersion
                  ? t('Requires version {{version}} or later', {
                      version: minimumVersion,
                    })
                  : t('Downloads will appear here when available')}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby='desktop-capabilities'>
          <div className='mb-4'>
            <h2
              id='desktop-capabilities'
              className='text-foreground text-xl font-semibold'
            >
              {t('From conversation to completed work')}
            </h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t(
                'Give BoxAI the context and tools it needs, while you stay in control.'
              )}
            </p>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <article
                  key={feature.title}
                  className='border-border bg-card rounded-xl border p-5 shadow-xs'
                >
                  <div className='bg-muted text-foreground mb-4 flex size-10 items-center justify-center rounded-lg'>
                    <Icon className='size-5' aria-hidden='true' />
                  </div>
                  <h3 className='text-foreground text-sm font-semibold'>
                    {t(feature.title)}
                  </h3>
                  <p className='text-muted-foreground mt-1.5 text-sm leading-6'>
                    {t(feature.description)}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        <section className='border-border bg-card grid overflow-hidden rounded-2xl border md:grid-cols-2'>
          <div className='border-border p-5 sm:p-7 md:border-r'>
            <CheckCircle2 className='text-success size-6' aria-hidden='true' />
            <h2 className='text-foreground mt-4 text-lg font-semibold'>
              {t('Approval stays with you')}
            </h2>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              {t(
                'Review consequential actions before they run. BoxAI shows what it plans to do and waits for your approval when it matters.'
              )}
            </p>
          </div>
          <div className='p-5 sm:p-7'>
            <LockKeyhole className='text-primary size-6' aria-hidden='true' />
            <h2 className='text-foreground mt-4 text-lg font-semibold'>
              {t('Local by design')}
            </h2>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              {t(
                'Local tools run on your device. You choose the files and connectors BoxAI can access, and you can revoke access at any time.'
              )}
            </p>
          </div>
        </section>
      </PageTransition>
    </div>
  )
}
