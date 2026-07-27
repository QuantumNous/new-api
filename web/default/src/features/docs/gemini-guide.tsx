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
import { InformationCircleIcon, Key01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

const GEMINI_REFERENCE_URL = 'https://github.com/google-gemini/gemini-cli'

export function DocsGemini() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const powershellConfig = `[Environment]::SetEnvironmentVariable(
  "GEMINI_API_KEY",
  "sk-your-api-key",
  "User"
)
[Environment]::SetEnvironmentVariable(
  "GOOGLE_GEMINI_BASE_URL",
  "${baseUrl}",
  "User"
)
[Environment]::SetEnvironmentVariable(
  "GEMINI_MODEL",
  "your-gemini-model-id",
  "User"
)`
  const shellConfig = `export GEMINI_API_KEY="sk-your-api-key"
export GOOGLE_GEMINI_BASE_URL="${baseUrl}"
export GEMINI_MODEL="your-gemini-model-id"`

  return (
    <DocsShell
      pageId='gemini'
      title='Gemini CLI'
      description={t(
        'Connect Gemini CLI through CC Switch or Gemini API key environment variables.'
      )}
      toc={[
        { id: 'cc-switch-import', label: t('Import with CC Switch') },
        { id: 'manual-config', label: t('Set environment variables') },
        { id: 'verify', label: t('Start and verify Gemini CLI') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='cc-switch-import' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Import with CC Switch')}</h2>
        <NumberedSteps
          items={[
            t('Open the API keys page and choose the CC Switch action.'),
            t('Select Gemini and choose an available Gemini model.'),
            t('Approve the import, save the provider, and switch to it.'),
            t('Restart Gemini CLI so it reads the new configuration.'),
          ]}
        />
        <Button className='mt-5' render={<Link to='/keys' />}>
          <HugeiconsIcon icon={Key01Icon} data-icon='inline-start' />
          {t('Open API keys')}
        </Button>
      </section>

      <section id='manual-config' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Set environment variables')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Set the API key, service root, and exact Gemini model ID before starting Gemini CLI.'
          )}
        </p>
        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          <CodeBlock code={powershellConfig} label='PowerShell' />
          <CodeBlock code={shellConfig} label='macOS / Linux' />
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Base URL requirement')}</AlertTitle>
          <AlertDescription>
            {t(
              'GOOGLE_GEMINI_BASE_URL must use the HTTPS service root without /v1. Localhost is the only HTTP exception supported by Gemini CLI.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='verify' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Start and verify Gemini CLI')}
        </h2>
        <NumberedSteps
          items={[
            t(
              'Open a new terminal after saving persistent variables; keep using the current terminal when you used export.'
            ),
            t('Run gemini and select Use Gemini API key when prompted.'),
            t('Send a short prompt and wait for a complete response.'),
            t(
              'Open usage logs and confirm the Gemini model and request status.'
            ),
          ]}
        />
        <div className='mt-5'>
          <CodeBlock code='gemini' label={t('Terminal')} />
        </div>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If Gemini CLI uses Google sign-in, restart it and select API key authentication.'
            ),
            t('For 404 errors, remove /v1 from GOOGLE_GEMINI_BASE_URL.'),
            t(
              'For model errors, confirm the selected model supports the Gemini endpoint type.'
            ),
            t(
              'For certificate errors, use the public HTTPS service address instead of an insecure remote URL.'
            ),
          ]}
        />
        <a
          href={GEMINI_REFERENCE_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground mt-5 inline-block underline underline-offset-4'
        >
          {t('Gemini CLI documentation')}
        </a>
      </section>
    </DocsShell>
  )
}
