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
import { ApiGatewayIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { useSystemConfig } from '@/hooks/use-system-config'

import { SectionHeading } from './section-heading'

export function GatewaySection() {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()
  const displayName = systemName || 'New API'
  const displayLogo = logo || '/logo.png'
  const inputNodes = [t('Chat'), t('Responses'), t('Images')]
  const outputNodes = [
    t('Model selection'),
    t('Channel routing'),
    t('Usage logs'),
  ]

  return (
    <section className='px-4 py-20 sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Unified gateway')}
          title={t(
            'Models can change while your product interface stays stable.'
          )}
          description={t(
            'One gateway accepts compatible endpoints and routes each request through the current configuration.'
          )}
          centered
        />

        <div className='border-border grid min-h-[31rem] items-center gap-7 border-y py-12 md:grid-cols-[1fr_13rem_1fr] md:gap-14 md:px-12'>
          <div className='flex flex-wrap justify-center gap-3 md:flex-col md:items-end md:gap-6'>
            {inputNodes.map((node) => (
              <div
                key={node}
                className='border-border bg-card text-muted-foreground md:after:bg-border relative flex min-h-13 w-32 items-center justify-center rounded-lg border px-3 text-sm font-medium md:after:absolute md:after:top-1/2 md:after:left-full md:after:h-px md:after:w-14'
              >
                {node}
              </div>
            ))}
          </div>

          <div className='border-primary/60 bg-card mx-auto flex min-h-36 w-full max-w-52 flex-col items-center justify-center rounded-lg border p-5 text-center shadow-xs'>
            <span className='border-border bg-background flex size-12 items-center justify-center overflow-hidden rounded-lg border'>
              <img
                src={displayLogo}
                alt=''
                className='size-full object-contain'
              />
            </span>
            <strong className='mt-3 max-w-full truncate text-sm'>
              {displayName}
            </strong>
            <span className='text-muted-foreground mt-1 flex items-center gap-1.5 text-xs'>
              <HugeiconsIcon icon={ApiGatewayIcon} className='size-3.5' />
              API Gateway
            </span>
          </div>

          <div className='flex flex-wrap justify-center gap-3 md:flex-col md:items-start md:gap-6'>
            {outputNodes.map((node) => (
              <div
                key={node}
                className='border-border bg-card text-muted-foreground md:before:bg-border relative flex min-h-13 w-32 items-center justify-center rounded-lg border px-3 text-center text-sm font-medium md:before:absolute md:before:top-1/2 md:before:right-full md:before:h-px md:before:w-14'
              >
                {node}
              </div>
            ))}
          </div>

          <div className='flex flex-wrap justify-center gap-2 md:col-span-3'>
            <Badge variant='outline'>{t('Unified authentication')}</Badge>
            <Badge variant='outline'>{t('Protocol adaptation')}</Badge>
            <Badge variant='outline'>{t('Routing logs')}</Badge>
          </div>
        </div>
      </div>
    </section>
  )
}
