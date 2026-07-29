/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CapabilityGrid } from './components/capability-grid'
import { DesktopFaq } from './components/desktop-faq'
import { DesktopHero } from './components/desktop-hero'
import { InstallGuide } from './components/install-guide'
import { ScreenshotShowcase } from './components/screenshot-showcase'
import { useDesktopRelease } from './hooks/use-desktop-release'
import { detectPlatform, primaryDownload } from './lib/release'

export function AgentsView() {
  const { t } = useTranslation()
  const { release, loading, fallbackUrl } = useDesktopRelease()
  const downloads = release?.downloads ?? []
  const primary = primaryDownload(downloads, detectPlatform())

  return (
    <div className='playground-discover-hero min-h-svh px-3 pt-20 pb-16 sm:px-5 sm:pt-24 md:px-8'>
      {/* Entrance comes from `PublicLayout`; this is just the measure. */}
      <div className='mx-auto max-w-5xl space-y-8 md:space-y-12'>
        <DesktopHero
          release={release}
          primary={primary}
          loading={loading}
          fallbackUrl={fallbackUrl}
        />

        <ScreenshotShowcase />

        <CapabilityGrid />

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

        {downloads.length > 0 && <InstallGuide downloads={downloads} />}

        <DesktopFaq />
      </div>
    </div>
  )
}
