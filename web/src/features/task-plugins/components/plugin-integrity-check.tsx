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
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'

type PluginIntegrityCheckProps = {
  compact?: boolean
  expected?: string
  digest?: string | null
  isLoading: boolean
}

export function PluginIntegrityCheck(props: PluginIntegrityCheckProps) {
  const { t } = useTranslation()
  let status: 'pending' | 'verified' | 'failed' | 'unavailable' | 'missing' =
    'missing'
  let label = t('No integrity hash')
  if (props.expected) {
    status = 'unavailable'
    label = t('File could not be verified')
    if (props.isLoading) {
      status = 'pending'
      label = t('Checking file integrity...')
    } else if (props.digest) {
      status =
        props.digest.toLowerCase() === props.expected.toLowerCase()
          ? 'verified'
          : 'failed'
      label =
        status === 'verified'
          ? t('File integrity verified')
          : t('Integrity check failed')
    }
  }
  return (
    <section
      className={props.compact ? 'space-y-1' : 'space-y-3'}
      aria-label={t('File verification')}
    >
      {!props.compact && (
        <h3 className='text-sm font-medium'>{t('File verification')}</h3>
      )}
      <Alert
        variant={status === 'failed' ? 'destructive' : 'default'}
        className={props.compact ? 'py-2' : undefined}
      >
        {status === 'pending' && <Spinner />}
        {status === 'verified' && (
          <CheckCircle2
            className='text-green-700 dark:text-green-400'
            aria-hidden='true'
          />
        )}
        {status === 'failed' && <AlertTriangle aria-hidden='true' />}
        {(status === 'unavailable' || status === 'missing') && (
          <Info aria-hidden='true' />
        )}
        <AlertTitle>{label}</AlertTitle>
        <AlertDescription className='text-xs leading-relaxed'>
          {status === 'failed' &&
            t(
              'This file differs from the one the source published. Do not install it.'
            )}
          {status === 'unavailable' &&
            t('The file is checked again when you install it.')}
          {status === 'missing' &&
            t('Read the plugin code before installing it.')}
          {status === 'verified' &&
            t('This file matches the one the source published.')}
        </AlertDescription>
      </Alert>
      {props.expected && (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button
                variant='ghost'
                size='sm'
                className='group h-auto gap-1 px-1 py-1 text-xs'
              />
            }
          >
            {t('Integrity hash')}
            <ChevronDown
              className='size-3 transition-transform group-aria-expanded:rotate-180'
              aria-hidden='true'
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className='bg-muted/20 mt-2 flex min-w-0 items-start gap-2 rounded-lg border p-3'>
              <code className='min-w-0 flex-1 text-xs leading-relaxed break-all'>
                {props.expected}
              </code>
              <CopyButton
                value={props.expected}
                className='size-6'
                iconClassName='size-3.5'
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
