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
import { ArrowRight01Icon, Key01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { ApiEndpointSection } from './components/api-endpoint-section'
import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

export function DocsApiIntegration() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const listModels = `curl "${baseUrl}/v1/models" \\
  -H "Authorization: Bearer sk-your-api-key"`
  const chatCompletions = `curl "${baseUrl}/v1/chat/completions" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": false
  }'`
  const responses = `curl "${baseUrl}/v1/responses" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "input": "Summarize the benefits of a unified AI gateway."
  }'`
  const anthropicMessages = `curl "${baseUrl}/v1/messages" \\
  -H "x-api-key: sk-your-api-key" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "max_tokens": 256,
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`
  const geminiGenerateContent = `curl "${baseUrl}/v1beta/models/your-model-id:generateContent" \\
  -H "x-goog-api-key: sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Hello"}]
      }
    ]
  }'`
  const embeddings = `curl "${baseUrl}/v1/embeddings" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-embedding-model-id",
    "input": "A short document to embed"
  }'`
  const streamingRequest = `curl -N "${baseUrl}/v1/chat/completions" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "messages": [
      {"role": "user", "content": "Count from one to five"}
    ],
    "stream": true
  }'`

  return (
    <DocsShell
      pageId='api-integration'
      title={t('API integration guide')}
      description={t(
        'Create an API key, choose the protocol required by the model, send a test request, and verify the result.'
      )}
      toc={[
        { id: 'quick-start', label: t('Quick start') },
        { id: 'choose-protocol', label: t('Choose an API protocol') },
        { id: 'authentication', label: t('Authentication') },
        { id: 'list-models', label: t('List models') },
        { id: 'chat-completions', label: t('Chat completions') },
        { id: 'responses-api', label: t('Responses API') },
        { id: 'anthropic-messages', label: t('Anthropic Messages API') },
        { id: 'gemini-api', label: t('Gemini generateContent API') },
        { id: 'embeddings', label: t('Embeddings') },
        { id: 'streaming', label: t('Verify streaming') },
        { id: 'errors', label: t('Errors and request IDs') },
      ]}
    >
      <section id='quick-start' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Quick start')}</h2>
        <NumberedSteps
          items={[
            t('Create an API key and keep it on your application server.'),
            t('List the models available to that key.'),
            t('Check the selected model endpoint type on the pricing page.'),
            t('Replace the placeholder model ID in the matching example.'),
            t('Send a small request and verify its usage log.'),
          ]}
        />
        <div className='mt-5 flex flex-wrap gap-3'>
          <Button render={<Link to='/keys' />}>
            {t('Open API keys')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button variant='outline' render={<Link to='/pricing' />}>
            {t('Open model pricing')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
          <Button variant='outline' render={<Link to='/usage-logs' />}>
            {t('Open usage logs')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>
      </section>

      <section id='choose-protocol' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Choose an API protocol')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use the endpoint type shown for the model. A model name alone does not guarantee that every protocol is available.'
          )}
        </p>
        <div className='border-border mt-5 overflow-x-auto rounded-lg border'>
          <table className='w-full min-w-[620px] text-left text-sm'>
            <thead className='bg-muted/40 text-muted-foreground'>
              <tr>
                <th className='px-4 py-3 font-medium'>{t('Protocol')}</th>
                <th className='px-4 py-3 font-medium'>{t('Endpoint')}</th>
                <th className='px-4 py-3 font-medium'>{t('Typical use')}</th>
              </tr>
            </thead>
            <tbody className='divide-border divide-y'>
              <tr>
                <td className='px-4 py-3'>OpenAI Chat Completions</td>
                <td className='px-4 py-3 font-mono'>/v1/chat/completions</td>
                <td className='px-4 py-3'>
                  {t('OpenAI-compatible chat clients and SDKs')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>OpenAI Responses</td>
                <td className='px-4 py-3 font-mono'>/v1/responses</td>
                <td className='px-4 py-3'>
                  {t('Responses-compatible agents and tools')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>Anthropic Messages</td>
                <td className='px-4 py-3 font-mono'>/v1/messages</td>
                <td className='px-4 py-3'>
                  {t('Claude and Anthropic-compatible clients')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3'>Gemini</td>
                <td className='px-4 py-3 font-mono'>/v1beta/models/...</td>
                <td className='px-4 py-3'>{t('Gemini SDKs and Gemini CLI')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id='authentication' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Authentication')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Send your API key as a Bearer token with every OpenAI-compatible request. Keep keys on the server and never expose them in browser code.'
          )}
        </p>
        <Alert className='mt-5'>
          <HugeiconsIcon icon={Key01Icon} aria-hidden='true' />
          <AlertTitle>{t('Authorization header')}</AlertTitle>
          <AlertDescription>
            <code>Authorization: Bearer sk-your-api-key</code>
          </AlertDescription>
        </Alert>
        <p className='text-muted-foreground mt-4 leading-7'>
          {t(
            'Anthropic-compatible requests use x-api-key together with anthropic-version. Gemini requests can use x-goog-api-key; using a header avoids placing the secret in the request URL.'
          )}
        </p>
      </section>

      <ApiEndpointSection
        id='list-models'
        title={t('List models')}
        description={t(
          'Returns the models currently available to the authenticated API key.'
        )}
        method='GET'
        path='/v1/models'
      >
        <CodeBlock code={listModels} label='cURL' />
      </ApiEndpointSection>

      <ApiEndpointSection
        id='chat-completions'
        title={t('Chat completions')}
        description={t(
          'Creates a model response from a conversation and supports streaming when stream is true.'
        )}
        method='POST'
        path='/v1/chat/completions'
      >
        <CodeBlock code={chatCompletions} label='cURL' />
        <div className='border-border overflow-x-auto rounded-lg border'>
          <table className='w-full min-w-[560px] text-left text-sm'>
            <thead className='bg-muted/40 text-muted-foreground'>
              <tr>
                <th className='px-4 py-3 font-medium'>{t('Field')}</th>
                <th className='px-4 py-3 font-medium'>{t('Type')}</th>
                <th className='px-4 py-3 font-medium'>{t('Description')}</th>
              </tr>
            </thead>
            <tbody className='divide-border divide-y'>
              <tr>
                <td className='px-4 py-3 font-mono'>model</td>
                <td className='text-muted-foreground px-4 py-3'>string</td>
                <td className='px-4 py-3'>{t('Exact model ID to use.')}</td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>messages</td>
                <td className='text-muted-foreground px-4 py-3'>array</td>
                <td className='px-4 py-3'>
                  {t('Conversation messages in chronological order.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>stream</td>
                <td className='text-muted-foreground px-4 py-3'>boolean</td>
                <td className='px-4 py-3'>
                  {t('Streams incremental events when enabled.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>temperature</td>
                <td className='text-muted-foreground px-4 py-3'>number</td>
                <td className='px-4 py-3'>
                  {t('Controls response randomness when supported.')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ApiEndpointSection>

      <ApiEndpointSection
        id='responses-api'
        title={t('Responses API')}
        description={t(
          'Uses the Responses format for text generation and tool-enabled workflows.'
        )}
        method='POST'
        path='/v1/responses'
      >
        <CodeBlock code={responses} label='cURL' />
      </ApiEndpointSection>

      <ApiEndpointSection
        id='anthropic-messages'
        title={t('Anthropic Messages API')}
        description={t(
          'Sends Anthropic-format messages. Use a model that supports the Anthropic endpoint type and include max_tokens.'
        )}
        method='POST'
        path='/v1/messages'
      >
        <CodeBlock code={anthropicMessages} label='cURL' />
      </ApiEndpointSection>

      <ApiEndpointSection
        id='gemini-api'
        title={t('Gemini generateContent API')}
        description={t(
          'Sends Gemini-format contents to generateContent. Put the exact model ID in the request path.'
        )}
        method='POST'
        path='/v1beta/models/{model}:generateContent'
      >
        <CodeBlock code={geminiGenerateContent} label='cURL' />
      </ApiEndpointSection>

      <ApiEndpointSection
        id='embeddings'
        title={t('Embeddings')}
        description={t(
          'Converts text into vectors for semantic search, clustering, and retrieval.'
        )}
        method='POST'
        path='/v1/embeddings'
      >
        <CodeBlock code={embeddings} label='cURL' />
      </ApiEndpointSection>

      <section id='streaming' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Verify streaming')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Use curl -N and stream: true. A working stream returns incremental server-sent events before the request finishes.'
          )}
        </p>
        <div className='mt-5'>
          <CodeBlock code={streamingRequest} label='cURL' />
        </div>
      </section>

      <section id='errors' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Errors and request IDs')}
        </h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Record the HTTP status, response message, request ID, timestamp, model, and endpoint when diagnosing a failed request.'
          )}
        </p>
        <div className='border-border mt-5 overflow-x-auto rounded-lg border'>
          <table className='w-full min-w-[520px] text-left text-sm'>
            <thead className='bg-muted/40 text-muted-foreground'>
              <tr>
                <th className='px-4 py-3 font-medium'>{t('Status')}</th>
                <th className='px-4 py-3 font-medium'>{t('Meaning')}</th>
              </tr>
            </thead>
            <tbody className='divide-border divide-y'>
              <tr>
                <td className='px-4 py-3 font-mono'>400</td>
                <td className='px-4 py-3'>
                  {t('The request body or selected model is not valid.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>401</td>
                <td className='px-4 py-3'>
                  {t('The API key is missing or invalid.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>429</td>
                <td className='px-4 py-3'>
                  {t('The rate limit or available quota was exceeded.')}
                </td>
              </tr>
              <tr>
                <td className='px-4 py-3 font-mono'>5xx</td>
                <td className='px-4 py-3'>
                  {t(
                    'The gateway or an upstream provider could not complete the request.'
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
