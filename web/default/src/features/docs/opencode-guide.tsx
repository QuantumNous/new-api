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

const OPENCODE_REFERENCE_URL = 'https://opencode.ai/docs/providers/'

export function DocsOpenCode() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const powershellApiKey = `[Environment]::SetEnvironmentVariable(
  "ALLTOKEN_API_KEY",
  "sk-your-api-key",
  "User"
)`
  const shellApiKey = `export ALLTOKEN_API_KEY="sk-your-api-key"`
  const providerConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "alltokenapi/your-model-id",
  "provider": {
    "alltokenapi": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "All Token API",
      "options": {
        "baseURL": "${baseUrl}/v1",
        "apiKey": "{env:ALLTOKEN_API_KEY}"
      },
      "models": {
        "your-model-id": {
          "name": "your-model-id"
        }
      }
    }
  }
}`

  return (
    <DocsShell
      pageId='opencode'
      title='OpenCode'
      description={t(
        'Add this service as an OpenAI-compatible provider in OpenCode.'
      )}
      toc={[
        { id: 'choose-config', label: t('Choose a configuration scope') },
        { id: 'add-provider', label: t('Add the provider') },
        { id: 'select-model', label: t('Select and verify the model') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='choose-config' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Choose a configuration scope')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use the global configuration for every project or place opencode.json in one project to override settings only there.'
          )}
        </p>
        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          <CodeBlock
            code='~/.config/opencode/opencode.json'
            label={t('Global configuration')}
          />
          <CodeBlock code='opencode.json' label={t('Project configuration')} />
        </div>
      </section>

      <section id='add-provider' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Add the provider')}</h2>
        <NumberedSteps
          items={[
            t('Set ALLTOKEN_API_KEY before starting OpenCode.'),
            t(
              'Copy an exact model ID from the pricing page and replace every your-model-id placeholder.'
            ),
            t('Merge the provider block into the selected configuration file.'),
          ]}
        />
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
        <div className='mt-5'>
          <CodeBlock code={providerConfig} label='opencode.json' />
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Choose the correct SDK adapter')}</AlertTitle>
          <AlertDescription>
            {t(
              'This example uses @ai-sdk/openai-compatible for /v1/chat/completions. Use @ai-sdk/openai only when the selected model specifically uses /v1/responses.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='select-model' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Select and verify the model')}
        </h2>
        <NumberedSteps
          items={[
            t('Start OpenCode in a new terminal.'),
            t('Run /models and select alltokenapi/your-model-id.'),
            t('Send a short prompt and wait for a complete response.'),
            t('Open usage logs and confirm the model and charge.'),
          ]}
        />
        <div className='mt-5'>
          <CodeBlock code={'opencode\n/models'} label={t('Terminal')} />
        </div>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If the provider is absent, validate opencode.json and confirm it is in the active configuration scope.'
            ),
            t(
              'If authentication fails, start OpenCode from a terminal that contains ALLTOKEN_API_KEY.'
            ),
            t(
              'If the request path is unsupported, match the SDK adapter to the model endpoint type.'
            ),
          ]}
        />
        <a
          href={OPENCODE_REFERENCE_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground mt-5 inline-block underline underline-offset-4'
        >
          {t('OpenCode provider documentation')}
        </a>
      </section>
    </DocsShell>
  )
}
