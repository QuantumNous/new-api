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
import {
  Download04Icon,
  InformationCircleIcon,
  Key01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'

const CCSWITCH_RELEASES_URL = 'https://github.com/farion1231/cc-switch/releases'
const CCSWITCH_DEEP_LINK_URL =
  'https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/zh/5-faq/5.3-deeplink.md'

export function DocsCcSwitch() {
  const { t } = useTranslation()

  return (
    <DocsShell
      pageId='cc-switch'
      title={t('CC Switch one-click import')}
      description={t(
        'Import a configured provider and API key into CC Switch without copying connection settings by hand.'
      )}
      toc={[
        { id: 'before-import', label: t('Before importing') },
        { id: 'one-click-import', label: t('Import from API keys') },
        { id: 'supported-apps', label: t('Supported import targets') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='before-import' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Before importing')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Install CC Switch on the same device as your browser, then create an API key and identify a model available to that key.'
          )}
        </p>
        <div className='mt-5 flex flex-wrap gap-3'>
          <Button render={<Link to='/keys' />}>
            <HugeiconsIcon icon={Key01Icon} data-icon='inline-start' />
            {t('Open API keys')}
          </Button>
          <Button
            variant='outline'
            render={
              <a
                href={CCSWITCH_RELEASES_URL}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <HugeiconsIcon icon={Download04Icon} data-icon='inline-start' />
            {t('Download CC Switch')}
          </Button>
        </div>
      </section>

      <section id='one-click-import' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Import from API keys')}</h2>
        <NumberedSteps
          items={[
            t('Open the API keys page and locate the key you want to use.'),
            t('Open the row actions and choose the CC Switch import action.'),
            t(
              'Choose the target application and select a model available to this API key.'
            ),
            t(
              'Approve the ccswitch:// browser prompt, then review the provider details in CC Switch.'
            ),
            t(
              'Save the provider, switch to it in CC Switch, and restart the target application.'
            ),
          ]}
        />
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Imported settings')}</AlertTitle>
          <AlertDescription>
            {t(
              'The link contains the provider name, endpoint, API key, selected model, and application-specific model fields. Only approve it on your own device.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='supported-apps' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Supported import targets')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The current API key dialog provides imports for Claude (used by Claude Code), Codex, and Gemini. Codex receives an endpoint ending in /v1, while Claude and Gemini receive the service root.'
          )}
        </p>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use the dedicated guide for each application to verify its model and endpoint requirements after importing.'
          )}
        </p>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If nothing opens, start CC Switch once and confirm that the ccswitch:// protocol is registered.'
            ),
            t(
              'If the browser blocks the prompt, allow external application links for this site and try again.'
            ),
            t(
              'If the provider imports but requests fail, recheck the selected model and the endpoint shown in the target application.'
            ),
            t(
              'Revoke and replace the API key immediately if the import link was opened on an untrusted device.'
            ),
          ]}
        />
        <a
          href={CCSWITCH_DEEP_LINK_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground mt-5 inline-block underline underline-offset-4'
        >
          {t('CC Switch deep-link reference')}
        </a>
      </section>
    </DocsShell>
  )
}
