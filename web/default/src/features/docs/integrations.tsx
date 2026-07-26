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
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

function StepList(props: { items: string[] }) {
  return (
    <ol className='mt-4 flex flex-col gap-3'>
      {props.items.map((item, index) => (
        <li
          key={item}
          className='grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 leading-7'
        >
          <span className='bg-muted flex size-7 items-center justify-center rounded-md text-xs font-semibold'>
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function DocsIntegrations() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="${baseUrl}/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)`
  const claudeCodeExample = `# macOS / Linux
export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
export ANTHROPIC_MODEL="claude-sonnet-4-5"

claude`
  const environmentExample = `OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=${baseUrl}/v1`

  return (
    <DocsShell
      pageId='integrations'
      title={t('Integration guide')}
      description={t(
        'Configure popular SDKs, coding agents, IDE extensions, and desktop clients.'
      )}
      toc={[
        { id: 'before-you-begin', label: t('Before you begin') },
        { id: 'openai-sdk', label: t('OpenAI SDK') },
        { id: 'claude-code', label: 'Claude Code' },
        { id: 'cherry-studio', label: 'Cherry Studio' },
        { id: 'cursor', label: 'Cursor' },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='before-you-begin' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Before you begin')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Create an API key and confirm which model names are available before configuring a client.'
          )}
        </p>
        <Alert className='mt-5'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Use the correct URL')}</AlertTitle>
          <AlertDescription>
            {t(
              'OpenAI-compatible clients usually require the /v1 suffix. Anthropic-compatible clients usually use the service origin without /v1.'
            )}
          </AlertDescription>
        </Alert>
        <div className='mt-5'>
          <CodeBlock
            code={environmentExample}
            label={t('Environment variables')}
          />
        </div>
      </section>

      <section id='openai-sdk' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('OpenAI SDK')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use the official OpenAI SDK and replace its default base URL with this gateway.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={pythonExample} label='Python' />
        </div>
      </section>

      <section id='claude-code' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>Claude Code</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Claude Code reads Anthropic-compatible settings from environment variables.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={claudeCodeExample} label='Shell' />
        </div>
      </section>

      <section id='cherry-studio' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>Cherry Studio</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Add a custom OpenAI-compatible provider and test the connection before selecting a default model.'
          )}
        </p>
        <StepList
          items={[
            t('Open provider settings and add an OpenAI-compatible provider.'),
            t('Enter the API key and set the API address to {{url}}.', {
              url: `${baseUrl}/v1`,
            }),
            t('Fetch the model list or add an available model name manually.'),
            t('Run the connection test and save the provider.'),
          ]}
        />
      </section>

      <section id='cursor' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>Cursor</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use Cursor or another OpenAI-compatible IDE client with the same base URL and API key.'
          )}
        </p>
        <StepList
          items={[
            t('Open the model or API settings page in the client.'),
            t('Enable the custom OpenAI base URL option.'),
            t('Set the base URL to {{url}} and enter your API key.', {
              url: `${baseUrl}/v1`,
            }),
            t('Select a supported model and send a short test request.'),
          ]}
        />
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <div className='border-border mt-5 overflow-x-auto rounded-lg border'>
          <table className='w-full min-w-[560px] text-left text-sm'>
            <thead className='bg-muted/40 text-muted-foreground'>
              <tr>
                <th className='px-4 py-3 font-medium'>{t('Problem')}</th>
                <th className='px-4 py-3 font-medium'>{t('Check')}</th>
              </tr>
            </thead>
            <tbody className='divide-border divide-y'>
              <tr>
                <td className='px-4 py-3'>{t('Authentication failed')}</td>
                <td className='px-4 py-3'>
                  {t('Confirm the API key is active and has no extra spaces.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>{t('Model not found')}</td>
                <td className='px-4 py-3'>
                  {t('List available models and use the exact model name.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>{t('Client returns 404')}</td>
                <td className='px-4 py-3'>
                  {t(
                    'Check whether the client expects the base URL with or without /v1.'
                  )}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>{t('Streaming does not start')}</td>
                <td className='px-4 py-3'>
                  {t(
                    'Disable client-side proxies temporarily and test a non-streaming request.'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DocsShell>
  )
}
