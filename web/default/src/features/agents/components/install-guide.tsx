/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'

import type { DesktopDownload } from '@/features/downloads/types'
import { ProseAccordion, type ProseAccordionEntry } from '@/components/prose-accordion'
import { SectionHeading } from '@/components/section-heading'

function ChecksumBlock(props: { download: DesktopDownload }) {
  const { t } = useTranslation()
  const command =
    props.download.platform === 'macos'
      ? `shasum -a 256 ${props.download.filename}`
      : `certutil -hashfile ${props.download.filename} SHA256`

  return (
    <div className='mt-3 space-y-1.5'>
      <p className='text-muted-foreground text-xs'>
        {t('Verify the download:')}
      </p>
      <pre className='bg-muted text-foreground overflow-x-auto rounded-lg px-3 py-2 text-xs'>
        <code>{command}</code>
      </pre>
      <p className='text-muted-foreground font-mono text-[11px] break-all'>
        {props.download.sha256}
      </p>
    </div>
  )
}

export function InstallGuide(props: { downloads: DesktopDownload[] }) {
  const { t } = useTranslation()
  const mac = props.downloads.find((download) => download.platform === 'macos')
  const windows = props.downloads.find(
    (download) => download.platform === 'windows' && download.kind === 'exe'
  )

  const entries: ProseAccordionEntry[] = []

  if (mac) {
    entries.push({
      id: 'macos',
      label: t('macOS'),
      body: (
        <>
          <ol className='list-decimal space-y-1 pl-4'>
            <li>{t('Open the downloaded .dmg file.')}</li>
            <li>{t('Drag BoxAI Desktop into your Applications folder.')}</li>
            <li>
              {t(
                'Launch it from Applications and sign in with your BoxAI account in the browser window that opens.'
              )}
            </li>
          </ol>
          <p>
            {mac.signed
              ? t(
                  'The build is signed with an Apple Developer ID and notarized by Apple, so macOS opens it without a security prompt.'
                )
              : t(
                  'This build is not notarized yet, so macOS blocks the first launch. Open it from Finder with Control-click, then choose Open to allow it once.'
                )}
          </p>
          <ChecksumBlock download={mac} />
        </>
      ),
    })
  }

  if (windows) {
    entries.push({
      id: 'windows',
      label: t('Windows'),
      body: (
        <>
          <ol className='list-decimal space-y-1 pl-4'>
            <li>{t('Run the downloaded installer.')}</li>
            {!windows.signed && (
              <li>
                {t(
                  'Windows SmartScreen will warn that the publisher is unknown: choose More info, then Run anyway.'
                )}
              </li>
            )}
            <li>
              {t(
                'Finish the installer and sign in with your BoxAI account in the browser window that opens.'
              )}
            </li>
          </ol>
          <p>
            {windows.signed
              ? t(
                  'The installer is code-signed, so Windows runs it without a SmartScreen warning. The SHA-256 below still lets you confirm the file byte for byte.'
                )
              : t(
                  'The Windows build is not code-signed yet, which is why SmartScreen steps in. Comparing the SHA-256 below with your download confirms you have the file we published.'
                )}
          </p>
          <ChecksumBlock download={windows} />
        </>
      ),
    })
  }

  entries.push({
    id: 'updates',
    label: t('Updates'),
    body: (
      <p>
        {t(
          'The app checks for new releases in the background and offers them in a card you can dismiss. Updates are cryptographically signed and are only installed after you choose to restart.'
        )}
      </p>
    ),
  })

  return (
    <section
      aria-labelledby='desktop-install'
      className='border-border/40 relative z-10 border-t px-6 py-20 md:py-28'
    >
      <div className='mx-auto max-w-6xl'>
        <SectionHeading
          id='desktop-install'
          eyebrow={t('Getting started')}
          title={t('A minute from download to your first task')}
          description={t(
            'Install, sign in with the BoxAI account you already have, and describe the outcome you want.'
          )}
        />
        <ProseAccordion entries={entries} />
      </div>
    </section>
  )
}
