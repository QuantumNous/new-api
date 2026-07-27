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
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

export function DocsOverview() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const listModels = `curl "${baseUrl}/v1/models" \\
  -H "Authorization: Bearer sk-your-api-key"`
  const firstRequest = `curl "${baseUrl}/v1/chat/completions" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`

  return (
    <DocsShell
      pageId='introduction'
      title={t('Gateway introduction')}
      description={t(
        'Learn what the gateway provides and complete the basic setup before making your first request.'
      )}
      toc={[
        {
          id: 'what-the-gateway-provides',
          label: t('What the gateway provides'),
        },
        { id: 'before-you-start', label: t('Before you start') },
        { id: 'create-api-key', label: t('Create an API key') },
        { id: 'service-address', label: t('Confirm the service address') },
        { id: 'list-models', label: t('List available models') },
        { id: 'first-request', label: t('Send the first request') },
        { id: 'verify-usage', label: t('Verify usage and continue') },
      ]}
    >
      <section id='what-the-gateway-provides' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('What the gateway provides')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The gateway provides one service address for supported AI models and keeps API keys, model access, billing, and usage records in one console.'
          )}
        </p>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Most OpenAI-compatible clients work after you replace the API key, base URL, and model name. Anthropic and Gemini clients use their own protocol routes described in the API integration guide.'
          )}
        </p>
      </section>

      <section id='before-you-start' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Before you start')}</h2>
        <NumberedSteps
          items={[
            t('Confirm that your wallet or subscription has available quota.'),
            t(
              'Open model pricing and choose a model that supports the endpoint required by your client.'
            ),
            t(
              'Record the exact model ID, input and output price, endpoint type, and any model-specific limits.'
            ),
          ]}
        />
        <div className='mt-5 flex flex-wrap gap-3'>
          <Button variant='outline' render={<Link to='/wallet' />}>
            {t('Open wallet')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button variant='outline' render={<Link to='/pricing' />}>
            {t('Open model pricing')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </section>

      <section id='create-api-key' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Create an API key')}</h2>
        <NumberedSteps
          items={[
            t('Open the API keys page and create a key for this client.'),
            t(
              'Set an expiration time, quota, model restriction, or IP restriction when your use case requires it.'
            ),
            t(
              'Copy the complete key when it is shown and store it in a password manager or server-side secret store.'
            ),
          ]}
        />
        <Button className='mt-5' render={<Link to='/keys' />}>
          {t('Open API keys')}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
        </Button>
      </section>

      <section id='service-address' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Confirm the service address')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'OpenAI-compatible clients normally use the following base URL. Tool-specific guides state when a client requires the service root without /v1.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={`${baseUrl}/v1`} label={t('Base URL')} />
        </div>
      </section>

      <section id='list-models' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('List available models')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Run this request with the new API key. A successful response returns only models currently available to that key.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={listModels} label='cURL' />
        </div>
      </section>

      <section id='first-request' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Send the first request')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Replace your-model-id with one value returned by the model list. This example uses the OpenAI Chat Completions protocol.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={firstRequest} label='cURL' />
        </div>
      </section>

      <section id='verify-usage' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Verify usage and continue')}
        </h2>
        <NumberedSteps
          items={[
            t(
              'Confirm that the response contains model output and no error object.'
            ),
            t(
              'Open usage logs and verify the request time, model, endpoint, token counts, and charge.'
            ),
            t(
              'Continue with the API integration guide or a tool-specific guide for production configuration.'
            ),
          ]}
        />
        <div className='mt-5 flex flex-wrap gap-3'>
          <Button variant='outline' render={<Link to='/usage-logs' />}>
            {t('Open usage logs')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button render={<Link to='/docs/api/integration' />}>
            {t('Open API integration guide')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </section>
    </DocsShell>
  )
}
