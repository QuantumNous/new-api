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
import { KeyRound, Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { DocsSection } from './docs-section'

const ENDPOINTS = [
  {
    key: 'openai',
    protocol: 'OpenAI',
    path: '/v1',
    description:
      'OpenAI Responses, Chat Completions, embeddings, and compatible routes.',
  },
  {
    key: 'anthropic',
    protocol: 'Anthropic',
    path: '/v1/messages',
    description: 'Claude Messages API compatible route.',
  },
  {
    key: 'gemini',
    protocol: 'Gemini',
    path: '/v1beta',
    description: 'Google Gemini API compatible route.',
  },
] as const

export function ApiReferenceSection(props: { gatewayUrl: string }) {
  const { t } = useTranslation()

  return (
    <DocsSection
      id='api-reference'
      title={t('API reference')}
      description={t(
        'Every compatible client uses the same gateway URL and one of the protocol routes below.'
      )}
    >
      <Card>
        <CardHeader className='border-border/60 border-b'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Route aria-hidden='true' className='text-primary size-4' />
            {t('Base URL')}
          </CardTitle>
          <CardDescription>
            {t('Use this address as the provider or gateway URL.')}
          </CardDescription>
          <div className='border-border/60 bg-muted/30 mt-3 flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2'>
            <code className='min-w-0 flex-1 truncate font-mono text-xs sm:text-sm'>
              {props.gatewayUrl}
            </code>
            <CopyButton
              value={props.gatewayUrl}
              aria-label={t('Copy gateway URL')}
              tooltip={t('Copy gateway URL')}
            />
          </div>
        </CardHeader>
        <CardContent className='space-y-5 pt-4'>
          <div className='flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3'>
            <Badge variant='outline'>
              <KeyRound aria-hidden='true' />
              {t('Authentication')}
            </Badge>
            <code className='font-mono text-xs sm:text-sm'>
              Authorization: Bearer &lt;YOUR_API_KEY&gt;
            </code>
          </div>

          <div className='overflow-hidden rounded-lg border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-muted/40 text-muted-foreground text-xs uppercase'>
                <tr>
                  <th className='px-3 py-2 font-medium'>{t('Protocol')}</th>
                  <th className='px-3 py-2 font-medium'>{t('Endpoint')}</th>
                  <th className='hidden px-3 py-2 font-medium md:table-cell'>
                    {t('Purpose')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((endpoint) => (
                  <tr key={endpoint.key} className='border-border/60 border-t'>
                    <td className='px-3 py-3 font-medium'>
                      {endpoint.protocol}
                    </td>
                    <td className='px-3 py-3'>
                      <code className='bg-muted/50 rounded px-1.5 py-0.5 font-mono text-xs'>
                        {endpoint.path}
                      </code>
                    </td>
                    <td className='text-muted-foreground hidden px-3 py-3 md:table-cell'>
                      {t(endpoint.description)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DocsSection>
  )
}
