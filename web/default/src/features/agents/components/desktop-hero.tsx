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
  failed: boolean
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
    <section
      aria-label={t('BoxAI Desktop')}
      className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32'
    >
      <div
        aria-hidden='true'
        className='from-primary/20 via-primary/5 absolute -top-40 right-0 size-[32rem] rounded-full bg-radial to-transparent blur-3xl'
      />
      <div className='relative mx-auto max-w-6xl'>
        <div className='max-w-3xl'>
          <div className='landing-animate-fade-up mb-5 flex flex-wrap items-center gap-2 opacity-0'>
            <div className='bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium'>
              <ShieldCheck className='size-3.5' aria-hidden='true' />
              {t('BoxAI Desktop')}
            </div>
            <Badge variant='outline'>{t('Beta')}</Badge>
          </div>

          <h1
            className='landing-animate-fade-up text-foreground text-3xl font-bold tracking-tight text-balance opacity-0 sm:text-4xl md:text-5xl'
            style={{ animationDelay: '60ms' }}
          >
            {t('An AI coworker that finishes the work on your computer')}
          </h1>
          <p
            className='landing-animate-fade-up text-muted-foreground mt-5 max-w-2xl text-sm leading-7 text-pretty opacity-0 sm:text-base'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'BoxAI Desktop runs the agent on your own machine, with your files, your terminal, and the apps you already use. You describe the outcome; it comes back with the finished document, spreadsheet, or message.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-8 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            <DownloadActions
              downloads={downloads}
              primary={props.primary}
              loading={props.loading}
              failed={props.failed}
              fallbackUrl={props.fallbackUrl}
            />
          </div>

          <dl
            className='landing-animate-fade-up text-muted-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-0'
            style={{ animationDelay: '240ms' }}
          >
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
      </div>
    </section>
  )
}
