/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import type { DesktopDownload } from '../types'

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

  return (
    <section aria-labelledby='desktop-install'>
      <div className='mb-4'>
        <h2
          id='desktop-install'
          className='text-foreground text-xl font-semibold'
        >
          {t('Installing')}
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t('A minute from download to your first task.')}
        </p>
      </div>

      <Accordion className='border-border bg-card rounded-xl border px-4'>
        <AccordionItem value='macos'>
          <AccordionTrigger>{t('macOS')}</AccordionTrigger>
          <AccordionContent className='text-muted-foreground space-y-2 pb-4 text-sm leading-6'>
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
              {t(
                'The build is signed with an Apple Developer ID and notarized by Apple, so macOS opens it without a security prompt.'
              )}
            </p>
            {mac && <ChecksumBlock download={mac} />}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='windows'>
          <AccordionTrigger>{t('Windows')}</AccordionTrigger>
          <AccordionContent className='text-muted-foreground space-y-2 pb-4 text-sm leading-6'>
            <ol className='list-decimal space-y-1 pl-4'>
              <li>{t('Run the downloaded installer.')}</li>
              <li>
                {t(
                  'Windows SmartScreen will warn that the publisher is unknown: choose More info, then Run anyway.'
                )}
              </li>
              <li>
                {t(
                  'Finish the installer and sign in with your BoxAI account in the browser window that opens.'
                )}
              </li>
            </ol>
            <p>
              {t(
                'The Windows build is not code-signed yet, which is why SmartScreen steps in. Comparing the SHA-256 below with your download confirms you have the file we published.'
              )}
            </p>
            {windows && <ChecksumBlock download={windows} />}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='updates'>
          <AccordionTrigger>{t('Updates')}</AccordionTrigger>
          <AccordionContent className='text-muted-foreground space-y-2 pb-4 text-sm leading-6'>
            <p>
              {t(
                'The app checks for new releases in the background and offers them in a card you can dismiss. Updates are cryptographically signed and are only installed after you choose to restart.'
              )}
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
