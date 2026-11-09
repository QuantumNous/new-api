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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'

import { IQPreview } from './preview'
import { artifactRevision, type IQModelCard, type IQStatus } from './types'

export function IQStatusLabel(props: { status: IQStatus }) {
  const { t } = useTranslation()
  switch (props.status) {
    case 'pending':
      return t('Pending')
    case 'running':
      return t('Running')
    case 'success':
      return t('Success')
    case 'timeout':
      return t('Timed out')
    case 'unavailable':
      return t('Model unavailable')
    case 'invalid_artifact':
      return t('Invalid artwork')
    case 'interrupted':
      return t('Interrupted')
    default:
      return t('Failed')
  }
}

export function IQTime(props: { seconds: number }) {
  const { t, i18n } = useTranslation()
  if (!props.seconds) return <>{t('Not scheduled')}</>
  return (
    <time dateTime={new Date(props.seconds * 1000).toISOString()}>
      {new Intl.DateTimeFormat(
        toIntlLocale(i18n.resolvedLanguage || i18n.language),
        { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }
      ).format(props.seconds * 1000)}
    </time>
  )
}

export function IQResultCard(props: {
  scope: string
  card: IQModelCard
  live: boolean
  onOpen: (revision: string) => void
}) {
  const { t } = useTranslation()
  const latest = props.card.latest
  const progress = props.card.progress
  const success = latest?.status === 'success'
  const revision = latest ? artifactRevision(latest) : ''
  return (
    <Card className='min-w-0' data-iq-preview={success ? revision : undefined}>
      <CardHeader>
        <CardTitle className='break-all'>{props.card.model}</CardTitle>
        <CardDescription>
          {latest ? (
            <>
              {t('Latest result')} · <IQTime seconds={latest.completed_at} />
            </>
          ) : (
            t('No result yet')
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='bg-muted flex min-h-64 items-center justify-center overflow-hidden rounded-lg'>
          {success && latest && props.live ? (
            <IQPreview scope={props.scope} result={latest} />
          ) : (
            <p className='text-muted-foreground p-6 text-center text-sm'>
              {success ? t('Open preview') : t('No artwork available')}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className='flex-wrap justify-between gap-3'>
        <div className='flex flex-wrap gap-2'>
          {latest && (
            <Badge variant={success ? 'secondary' : 'destructive'}>
              <IQStatusLabel status={latest.status} />
            </Badge>
          )}
          {progress && (
            <Badge variant='outline'>
              {t('Current run')}: <IQStatusLabel status={progress.status} />
            </Badge>
          )}
        </div>
        {success && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => props.onOpen(revision)}
            aria-label={t('Preview {{model}}', { model: props.card.model })}
          >
            {t('Open preview')}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
