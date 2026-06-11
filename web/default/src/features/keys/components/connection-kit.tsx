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
import { Link } from '@tanstack/react-router'
import { KeyRound, RadioTower, TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { useApiKeys } from './api-keys-provider'

function getOrigin() {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  return window.location.origin
}

function getBaseUrl(serverAddress?: string) {
  const base = serverAddress?.trim() || getOrigin()
  return `${base.replace(/\/+$/, '')}/v1`
}

export function ConnectionKit() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { setOpen } = useApiKeys()
  const baseUrl = getBaseUrl(status?.server_address as string | undefined)
  const bearerHeader = 'Authorization: Bearer sk-...'

  return (
    <section className='surface-glass overflow-hidden rounded-2xl shadow-none'>
      <div className='grid gap-px bg-border/60 lg:grid-cols-[minmax(0,1fr)_18rem]'>
        <div className='bg-background/70 p-4 sm:p-5'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0'>
              <div className='operator-metric-label'>{t('Connection Kit')}</div>
              <h3 className='mt-1 text-base font-semibold tracking-tight'>
                {t('Ship your first request faster')}
              </h3>
              <p className='text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed'>
                {t(
                  'Copy the gateway endpoint, create a key, then open a compatible client without hunting through settings.'
                )}
              </p>
            </div>
            <Button size='sm' onClick={() => setOpen('create')}>
              <KeyRound data-icon='inline-start' />
              {t('Create API Key')}
            </Button>
          </div>

          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            <div className='surface-console rounded-xl border p-3'>
              <div className='operator-metric-label'>{t('Base URL')}</div>
              <div className='mt-2 flex min-w-0 items-center gap-2'>
                <code className='operator-number min-w-0 flex-1 truncate text-sm'>
                  {baseUrl}
                </code>
                <CopyButton
                  value={baseUrl}
                  variant='outline'
                  size='icon'
                  tooltip={t('Copy Base URL')}
                />
              </div>
            </div>
            <div className='surface-console rounded-xl border p-3'>
              <div className='operator-metric-label'>{t('Bearer Header')}</div>
              <div className='mt-2 flex min-w-0 items-center gap-2'>
                <code className='operator-number min-w-0 flex-1 truncate text-sm'>
                  {bearerHeader}
                </code>
                <CopyButton
                  value={bearerHeader}
                  variant='outline'
                  size='icon'
                  tooltip={t('Copy Bearer Header')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className='bg-background/70 p-4 sm:p-5'>
          <div className='operator-metric-label'>{t('Client presets')}</div>
          <div className='mt-3 grid gap-2'>
            <Button
              variant='outline'
              className='justify-start rounded-xl'
              render={<a href='https://cherry-ai.com' target='_blank' rel='noopener noreferrer' />}
            >
              <RadioTower data-icon='inline-start' />
              Cherry Studio
            </Button>
            <Button
              variant='outline'
              className='justify-start rounded-xl'
              render={<a href='https://ccswitch.io' target='_blank' rel='noopener noreferrer' />}
            >
              <TerminalSquare data-icon='inline-start' />
              CC Switch
            </Button>
            <Button variant='outline' className='justify-start rounded-xl' render={<Link to='/playground' />}>
              <TerminalSquare data-icon='inline-start' />
              {t('Playground')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
