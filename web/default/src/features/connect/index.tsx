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

import { detectPlatform, primaryDownload } from '@/features/downloads/release'

import { ConnectCapabilities } from './components/connect-capabilities'
import { ConnectFaq } from './components/connect-faq'
import { ConnectHero } from './components/connect-hero'
import { SupportedClients } from './components/supported-clients'
import { useConnectRelease } from './hooks/use-connect-release'

export function ConnectView() {
  const { t } = useTranslation()
  const { release, loading, failed, fallbackUrl } = useConnectRelease()
  const downloads = release?.downloads ?? []
  const primary = primaryDownload(downloads, detectPlatform())

  useSeo(
    useMemo(
      () => ({
        title: t('BoxAI Connect'),
        description: t(
          'BoxAI Connect is a desktop app that signs in to your BoxAI account and configures Claude Code, Codex CLI, Gemini CLI and other AI coding clients to use it.'
        ),
        path: '/connect',
      }),
      [t]
    )
  )

  return (
    <main className='playground-discover-hero min-h-svh'>
      {/* Entrance comes from `PublicLayout`; sections own their own padding and rhythm. */}
      <ConnectHero
        release={release}
        primary={primary}
        loading={loading}
        failed={failed}
        fallbackUrl={fallbackUrl}
      />

      <SupportedClients />

      <ConnectCapabilities />

      <ConnectFaq />
    </main>
  )
}
