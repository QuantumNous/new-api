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
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

const HERMES_REFERENCE_URL = 'https://github.com/NousResearch/hermes-agent'

export function DocsHermes() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const powershellApiKey = `[Environment]::SetEnvironmentVariable(
  "ALLTOKEN_API_KEY",
  "sk-your-api-key",
  "User"
)`
  const shellApiKey = `export ALLTOKEN_API_KEY="sk-your-api-key"`
  const manualConfig = `model:
  default: your-model-id
  provider: custom
  base_url: ${baseUrl}/v1
  api_key: \${ALLTOKEN_API_KEY}
  api_mode: chat_completions`
  const verifyCommands = `hermes config path
hermes config env-path
hermes config check
hermes config get model --json
hermes status`

  return (
    <DocsShell
      pageId='hermes'
      title='Hermes'
      description={t(
        'Configure Hermes Agent with its custom endpoint wizard or config.yaml.'
      )}
      toc={[
        { id: 'wizard', label: t('Configure with the wizard') },
        { id: 'manual-config', label: t('Edit config.yaml manually') },
        { id: 'verify', label: t('Verify the configuration') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='wizard' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Configure with the wizard')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The model wizard is the recommended setup path because it writes the current Hermes configuration format.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code='hermes model' label={t('Terminal')} />
        </div>
        <NumberedSteps
          items={[
            t('Run hermes model and select Custom endpoint.'),
            t('Enter the service URL ending in /v1.'),
            t(
              'Enter your API key and an exact model ID from the pricing page.'
            ),
            t(
              'Choose chat_completions unless the selected model specifically requires another API mode.'
            ),
            t('Save the configuration and start a new Hermes session.'),
          ]}
        />
      </section>

      <section id='manual-config' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Edit config.yaml manually')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Hermes stores its main configuration at ~/.hermes/config.yaml. Store the API key in an environment variable, then merge the model block into the existing file.'
          )}
        </p>
        <h3 className='mt-8 text-lg font-semibold'>
          {t('Set the API key environment variable')}
        </h3>
        <p className='text-muted-foreground mt-2 leading-7'>
          {t(
            'On Windows, open a new terminal after setting the persistent user variable. On macOS and Linux, export applies only to the current shell unless you add it to your shell profile.'
          )}
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <CodeBlock code={powershellApiKey} label='PowerShell' />
          <CodeBlock code={shellApiKey} label='macOS / Linux' />
        </div>
        <h3 className='mt-8 text-lg font-semibold'>{t('Edit config.yaml')}</h3>
        <div className='mt-5'>
          <CodeBlock code={manualConfig} label='~/.hermes/config.yaml' />
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Current configuration format')}</AlertTitle>
          <AlertDescription>
            {t(
              'Hermes expands ${VAR} and ${env:VAR} references when it loads config.yaml. LLM_MODEL is no longer used for custom endpoints.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='verify' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Verify the configuration')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Inspect the resolved model settings and Hermes status before starting a real task.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={verifyCommands} label={t('Terminal')} />
        </div>
        <NumberedSteps
          items={[
            t(
              'Run hermes config check and fix every reported configuration error.'
            ),
            t(
              'Confirm provider is custom, base_url ends in /v1, and api_key still contains an environment-variable reference.'
            ),
            t('Start a new session and send a short prompt.'),
            t('Check usage logs for the selected model and request status.'),
          ]}
        />
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'For 404 errors, confirm the custom base_url ends in /v1 exactly once.'
            ),
            t(
              'For model errors, replace the display name with the exact model ID.'
            ),
            t(
              'Use chat_completions for /v1/chat/completions, codex_responses for /v1/responses, or anthropic_messages for /v1/messages.'
            ),
            t(
              'If authentication fails, confirm ALLTOKEN_API_KEY is available to the process that starts Hermes.'
            ),
          ]}
        />
        <a
          href={HERMES_REFERENCE_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground mt-5 inline-block underline underline-offset-4'
        >
          {t('Hermes Agent documentation')}
        </a>
      </section>
    </DocsShell>
  )
}
