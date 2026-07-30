/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

import type { DesktopDownload } from '@/features/downloads/types'
import { DownloadActions } from '@/features/downloads/download-actions'

export function DesktopCta(props: {
  primary?: DesktopDownload
  loading: boolean
  failed: boolean
  fallbackUrl: string
}) {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  return (
    <section
      aria-labelledby='desktop-cta'
      className='border-border/40 relative z-10 overflow-hidden border-t px-6 py-24 md:py-28'
    >
      <div
        aria-hidden='true'
        className='absolute inset-0 -z-10 opacity-25 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 55% at 30% 50%, oklch(0.7 0.15 250 / 70%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 45% at 75% 40%, oklch(0.65 0.12 280 / 55%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <AnimateInView
        className='mx-auto flex max-w-2xl flex-col items-center text-center'
        animation='scale-in'
      >
        <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
          {t('Get started')}
        </p>
        <h2
          id='desktop-cta'
          className='text-2xl leading-tight font-bold tracking-tight text-balance md:text-4xl'
        >
          {t('Put an AI coworker on your desktop')}
        </h2>
        <p className='text-muted-foreground mt-4 text-sm leading-relaxed text-pretty'>
          {t(
            'Model access comes from the BoxAI account you already have, so nothing new to set up and nothing extra to pay for.'
          )}
        </p>

        <div className='mt-8'>
          <DownloadActions
            downloads={[]}
            primary={props.primary}
            loading={props.loading}
            failed={props.failed}
            fallbackUrl={props.fallbackUrl}
            productName={t('BoxAI Desktop')}
          />
        </div>

        {!isAuthenticated && (
          <Button
            variant='outline'
            className='border-border/50 hover:border-border hover:bg-muted/50 mt-3 rounded-full'
            render={<Link to='/sign-up' />}
          >
            {t('Create a BoxAI account')}
          </Button>
        )}
      </AnimateInView>
    </section>
  )
}
