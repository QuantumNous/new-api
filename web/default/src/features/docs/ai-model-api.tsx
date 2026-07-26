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
import { Key01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { ApiEndpointSection } from './components/api-endpoint-section'
import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

export function DocsAiModelApi() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const listModels = `curl "${baseUrl}/v1/models" \\
  -H "Authorization: Bearer sk-your-api-key"`
  const chatCompletions = `curl "${baseUrl}/v1/chat/completions" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": false
  }'`
  const responses = `curl "${baseUrl}/v1/responses" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4.1-mini",
    "input": "Summarize the benefits of a unified AI gateway."
  }'`
  const embeddings = `curl "${baseUrl}/v1/embeddings" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "text-embedding-3-small",
    "input": "A short document to embed"
  }'`

  return (
    <DocsShell
      pageId='ai-model'
      title={t('AI model API')}
      description={t(
        'Call text and embedding models through OpenAI-compatible REST endpoints.'
      )}
      toc={[
        { id: 'authentication', label: t('Authentication') },
        { id: 'list-models', label: t('List models') },
        { id: 'chat-completions', label: t('Chat completions') },
        { id: 'responses-api', label: t('Responses API') },
        { id: 'embeddings', label: t('Embeddings') },
        { id: 'errors', label: t('Errors') },
      ]}
    >
      <section id='authentication' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Authentication')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Send your API key as a Bearer token with every model request. Keep keys on the server and never expose them in browser code.'
          )}
        </p>
        <Alert className='mt-5'>
          <HugeiconsIcon icon={Key01Icon} aria-hidden='true' />
          <AlertTitle>{t('Authorization header')}</AlertTitle>
          <AlertDescription>
            <code>Authorization: Bearer sk-your-api-key</code>
          </AlertDescription>
        </Alert>
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
                <td className='px-4 py-3'>{t('Model name to use.')}</td>
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
          'Uses the newer Responses format for text generation and tool-enabled workflows.'
        )}
        method='POST'
        path='/v1/responses'
      >
        <CodeBlock code={responses} label='cURL' />
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

      <section id='errors' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Errors')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Errors use a JSON response body. Log the request identifier and message when contacting support.'
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
