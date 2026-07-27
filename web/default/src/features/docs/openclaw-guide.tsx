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

const OPENCLAW_REFERENCE_URL =
  'https://github.com/openclaw/openclaw/blob/main/docs/gateway/configuration-reference.md'

export function DocsOpenClaw() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const configPath = '~/.openclaw/openclaw.json'
  const powershellApiKey = `[Environment]::SetEnvironmentVariable(
  "ALLTOKEN_API_KEY",
  "sk-your-api-key",
  "User"
)`
  const shellApiKey = `export ALLTOKEN_API_KEY="sk-your-api-key"`
  const config = `{
  "models": {
    "mode": "merge",
    "providers": {
      "alltokenapi": {
        "baseUrl": "${baseUrl}/v1",
        "apiKey": "\${ALLTOKEN_API_KEY}",
        "api": "openai-responses",
        "models": [
          {
            "id": "your-model-id",
            "name": "your-model-id"
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "alltokenapi/your-model-id"
      }
    }
  }
}`
  const verifyCommands = `openclaw config file
openclaw config validate
openclaw models status
openclaw doctor`

  return (
    <DocsShell
      pageId='openclaw'
      title='OpenClaw'
      description={t(
        'Register this service as a custom OpenAI Responses provider in OpenClaw.'
      )}
      toc={[
        { id: 'prepare', label: t('Prepare the model and key') },
        { id: 'edit-config', label: t('Edit openclaw.json') },
        { id: 'validate', label: t('Validate and restart') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='prepare' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Prepare the model and key')}
        </h2>
        <NumberedSteps
          items={[
            t('Create an API key and copy it to a secure password manager.'),
            t(
              'Choose a model that supports the Responses endpoint and copy its exact model ID.'
            ),
            t(
              'Set ALLTOKEN_API_KEY in the environment used to start the OpenClaw gateway.'
            ),
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
        <p className='text-muted-foreground mt-4 leading-7'>
          {t(
            'If OpenClaw runs as a service, add the same variable to the service environment so the gateway process can read it.'
          )}
        </p>
      </section>

      <section id='edit-config' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Edit openclaw.json')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t('The default user configuration file is shown below.')}
        </p>
        <div className='mt-4'>
          <CodeBlock code={configPath} label={t('Configuration path')} />
        </div>
        <p className='text-muted-foreground mt-5 leading-7'>
          {t(
            'Merge the provider and default model blocks into your existing file. Keep unrelated gateway, agent, and tool settings unchanged.'
          )}
        </p>
        <div className='mt-4'>
          <CodeBlock code={config} label='openclaw.json' />
        </div>
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Model identifier')}</AlertTitle>
          <AlertDescription>
            {t(
              'Replace both occurrences of your-model-id. OpenClaw addresses the result as alltokenapi/your-model-id.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='validate' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Validate and restart')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Run the built-in checks before restarting the gateway process or service.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={verifyCommands} label={t('Terminal')} />
        </div>
        <NumberedSteps
          items={[
            t('Fix every validation error before restarting the gateway.'),
            t(
              'Restart the OpenClaw gateway using your normal service command.'
            ),
            t('Start a short agent task and confirm it appears in usage logs.'),
          ]}
        />
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If the provider is missing, confirm models.mode is merge and the JSON structure is valid.'
            ),
            t(
              'If the API key is empty, ensure the gateway service inherits ALLTOKEN_API_KEY.'
            ),
            t(
              'If the model is rejected, confirm the exact ID and Responses endpoint support on the pricing page.'
            ),
            t(
              'Do not invent contextWindow or maxTokens values; omit them unless the model requires explicit limits.'
            ),
          ]}
        />
        <a
          href={OPENCLAW_REFERENCE_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='text-foreground mt-5 inline-block underline underline-offset-4'
        >
          {t('OpenClaw configuration reference')}
        </a>
      </section>
    </DocsShell>
  )
}
