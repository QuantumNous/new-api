/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useSeo } from '@/hooks/use-page-seo'

import { CapabilityGrid } from './components/capability-grid'
import { DesktopCta } from './components/desktop-cta'
import { DesktopFaq } from './components/desktop-faq'
import { DesktopHero } from './components/desktop-hero'
import { InstallGuide } from './components/install-guide'
import { ScreenshotShowcase } from './components/screenshot-showcase'
import { TrustPanel } from './components/trust-panel'
import { useDesktopRelease } from './hooks/use-desktop-release'
import { detectPlatform, primaryDownload } from '@/features/downloads/release'

export function AgentsView() {
  const { t } = useTranslation()
  const { release, loading, failed, fallbackUrl } = useDesktopRelease()
  const downloads = release?.downloads ?? []
  const primary = primaryDownload(downloads, detectPlatform())

  useSeo(
    useMemo(
      () => ({
        title: t('BoxAI Desktop'),
        description: t(
          'BoxAI Desktop is an AI coworker that runs on your own machine, works with your files, terminal, and connected apps, and returns finished work.'
        ),
        path: '/agents',
      }),
      [t]
    )
  )

  return (
    <main className='playground-discover-hero min-h-svh'>
      {/* Entrance comes from `PublicLayout`; sections own their own padding and rhythm. */}
      <DesktopHero
        release={release}
        primary={primary}
        loading={loading}
        failed={failed}
        fallbackUrl={fallbackUrl}
      />

      <ScreenshotShowcase />

      <CapabilityGrid />

      <TrustPanel />

      {downloads.length > 0 && <InstallGuide downloads={downloads} />}

      <DesktopFaq />

      <DesktopCta
        primary={primary}
        loading={loading}
        failed={failed}
        fallbackUrl={fallbackUrl}
      />
    </main>
  )
}
