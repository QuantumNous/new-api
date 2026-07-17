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
  ApiIcon,
  ArrowRight01Icon,
  InformationCircleIcon,
  PlugSocketIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { CodeBlock } from './components/code-block'
import { DocsShell } from './components/docs-shell'
import { useDocsBaseUrl } from './hooks/use-docs-base-url'

export function DocsOverview() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const firstRequest = `curl "${baseUrl}/v1/models" \\
  -H "Authorization: Bearer sk-your-api-key"`

  return (
    <DocsShell
      pageId='overview'
      title={t('API documentation')}
      description={t(
        'Connect your applications to leading AI models through one compatible API.'
      )}
      toc={[
        { id: 'introduction', label: t('Introduction') },
        { id: 'quick-start', label: t('Quick start') },
        { id: 'core-resources', label: t('Core resources') },
      ]}
    >
      <section id='introduction' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Introduction')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The gateway exposes OpenAI-compatible endpoints for models, chat, responses, embeddings, images, and audio. Use the same API key and base URL across supported clients.'
          )}
        </p>
        <Alert className='mt-5'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('OpenAI compatible')}</AlertTitle>
          <AlertDescription>
            {t(
              'Most OpenAI SDKs work by changing only the API key, base URL, and model name.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='quick-start' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Quick start')}</h2>
        <ol className='mt-5 flex flex-col gap-6'>
          <li className='grid grid-cols-[2rem_minmax(0,1fr)] gap-3'>
            <span className='bg-muted flex size-8 items-center justify-center rounded-lg text-sm font-semibold'>
              1
            </span>
            <div>
              <h3 className='font-semibold'>{t('Create an API key')}</h3>
              <p className='text-muted-foreground mt-1 leading-7'>
                {t(
                  'Sign in to the console, open API keys, and create a key for your application.'
                )}
              </p>
            </div>
          </li>
          <li className='grid grid-cols-[2rem_minmax(0,1fr)] gap-3'>
            <span className='bg-muted flex size-8 items-center justify-center rounded-lg text-sm font-semibold'>
              2
            </span>
            <div>
              <h3 className='font-semibold'>{t('Set the base URL')}</h3>
              <p className='text-muted-foreground mt-1 leading-7'>
                {t('Use this service address in your SDK or client.')}
              </p>
              <code className='border-border bg-muted/40 mt-2 inline-block max-w-full overflow-x-auto rounded-md border px-2.5 py-1.5 font-mono text-sm'>
                {baseUrl}/v1
              </code>
            </div>
          </li>
          <li className='grid grid-cols-[2rem_minmax(0,1fr)] gap-3'>
            <span className='bg-muted flex size-8 items-center justify-center rounded-lg text-sm font-semibold'>
              3
            </span>
            <div>
              <h3 className='font-semibold'>{t('Send your first request')}</h3>
              <p className='text-muted-foreground mt-1 leading-7'>
                {t(
                  'List the models available to your API key before selecting one for a request.'
                )}
              </p>
            </div>
          </li>
        </ol>
        <div className='mt-5'>
          <CodeBlock code={firstRequest} label='cURL' />
        </div>
      </section>

      <section id='core-resources' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Core resources')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'Continue with the endpoint reference or configure a supported development tool.'
          )}
        </p>
        <div className='mt-5 grid gap-4 sm:grid-cols-2'>
          <Link to='/docs/ai-model' className='group block'>
            <Card className='h-full transition-shadow group-hover:shadow-md'>
              <CardHeader>
                <div className='bg-muted mb-2 flex size-9 items-center justify-center rounded-lg'>
                  <HugeiconsIcon
                    icon={ApiIcon}
                    className='size-5'
                    aria-hidden='true'
                  />
                </div>
                <CardTitle>{t('AI model API')}</CardTitle>
                <CardDescription>
                  {t(
                    'Review authentication, endpoints, request fields, and response examples.'
                  )}
                </CardDescription>
                <CardAction>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className='text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5'
                    aria-hidden='true'
                  />
                </CardAction>
              </CardHeader>
            </Card>
          </Link>
          <Link to='/docs/integrations' className='group block'>
            <Card className='h-full transition-shadow group-hover:shadow-md'>
              <CardHeader>
                <div className='bg-muted mb-2 flex size-9 items-center justify-center rounded-lg'>
                  <HugeiconsIcon
                    icon={PlugSocketIcon}
                    className='size-5'
                    aria-hidden='true'
                  />
                </div>
                <CardTitle>{t('Integration guide')}</CardTitle>
                <CardDescription>
                  {t(
                    'Connect OpenAI SDKs, Claude Code, Cherry Studio, Cursor, and compatible clients.'
                  )}
                </CardDescription>
                <CardAction>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className='text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5'
                    aria-hidden='true'
                  />
                </CardAction>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>
    </DocsShell>
  )
}
