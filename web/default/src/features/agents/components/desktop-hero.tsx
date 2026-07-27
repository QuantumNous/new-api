/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { formatSize } from '../lib/release'
import type { DesktopDownload, DesktopRelease } from '../types'
import { DownloadActions } from './download-actions'

export function DesktopHero(props: {
  release?: DesktopRelease
  primary?: DesktopDownload
  loading: boolean
  fallbackUrl: string
}) {
  const { t } = useTranslation()
  const downloads = props.release?.downloads ?? []

  let requirement = t('macOS 12 or later · Windows 10 or later')
  if (props.primary?.platform === 'macos') {
    requirement = t('Requires macOS {{version}} or later', {
      version: props.primary.minimum_os,
    })
  } else if (props.primary?.platform === 'windows') {
    requirement = t('Requires Windows {{version}} or later', {
      version: props.primary.minimum_os,
    })
  }

  return (
    <section className='border-border bg-card relative overflow-hidden rounded-2xl border px-5 py-8 shadow-sm sm:px-8 sm:py-10 md:px-12 md:py-14'>
      <div
        aria-hidden='true'
        className='from-primary/20 via-primary/5 absolute -top-32 -right-24 size-80 rounded-full bg-radial to-transparent blur-2xl'
      />
      <div className='relative max-w-3xl'>
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <div className='bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium'>
            <ShieldCheck className='size-3.5' aria-hidden='true' />
            {t('BoxAI Desktop')}
          </div>
          <Badge variant='outline'>{t('Beta')}</Badge>
        </div>

        <h1 className='text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl'>
          {t('An AI coworker that finishes the work on your computer')}
        </h1>
        <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-6 text-pretty sm:text-base sm:leading-7'>
          {t(
            'BoxAI Desktop runs the agent on your own machine, with your files, your terminal, and the apps you already use. You describe the outcome; it comes back with the finished document, spreadsheet, or message.'
          )}
        </p>

        <div className='mt-7'>
          <DownloadActions
            downloads={downloads}
            primary={props.primary}
            loading={props.loading}
            fallbackUrl={props.fallbackUrl}
          />
        </div>

        <dl className='text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
          {props.release && (
            <div className='flex items-center gap-1.5'>
              <dt className='sr-only'>{t('Version')}</dt>
              <dd>
                {t('Version {{version}}', { version: props.release.version })}
              </dd>
            </div>
          )}
          {props.primary && (
            <div className='flex items-center gap-1.5'>
              <dt className='sr-only'>{t('Download size')}</dt>
              <dd>{formatSize(props.primary.size)}</dd>
            </div>
          )}
          <div className='flex items-center gap-1.5'>
            <dt className='sr-only'>{t('System requirements')}</dt>
            <dd>{requirement}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
