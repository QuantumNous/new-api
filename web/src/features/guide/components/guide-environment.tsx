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
  Alert02Icon,
  BookOpenTextIcon,
  ReloadIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

import type { GuideEnvironmentState } from '../hooks/use-guide-environment'

type GuideEnvironmentProps = {
  environment: GuideEnvironmentState
}

export function GuideEnvironment(props: GuideEnvironmentProps) {
  const { t } = useTranslation()

  if (props.environment.status === 'loading') {
    return (
      <section
        aria-label={t('Your current setup')}
        className='border-border bg-card grid gap-3 rounded-2xl border p-4 sm:grid-cols-3'
      >
        <Skeleton className='h-14 rounded-xl' />
        <Skeleton className='h-14 rounded-xl' />
        <Skeleton className='h-14 rounded-xl' />
      </section>
    )
  }

  if (props.environment.status === 'error') {
    return (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        <AlertTitle>{t('We could not verify your setup')}</AlertTitle>
        <AlertDescription>
          {t(
            'Retry before copying a configuration so the model and group stay accurate.'
          )}
        </AlertDescription>
        <AlertAction>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={props.environment.retry}
          >
            <HugeiconsIcon icon={ReloadIcon} data-icon='inline-start' />
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (props.environment.status === 'empty') {
    return (
      <Empty className='border-border bg-card border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={BookOpenTextIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>{t('No compatible models are available')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'This account has no model enabled for the protocol required by this article.'
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant='outline' render={<Link to='/pricing' />}>
            {t('Open Models')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const selectedGroupLabel =
    props.environment.groups.find(
      (group) => group.value === props.environment.runtime.group
    )?.label ?? props.environment.runtime.group

  return (
    <section
      aria-label={t('Your current setup')}
      className='border-border bg-card rounded-2xl border p-4 shadow-xs'
    >
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h2 className='text-sm font-medium'>{t('Your current setup')}</h2>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Examples update when you change the model or group.')}
          </p>
        </div>
        <div className='flex min-w-0 flex-wrap gap-1.5'>
          <Badge variant='outline'>{props.environment.runtime.model}</Badge>
          <Badge variant='secondary'>{selectedGroupLabel}</Badge>
        </div>
      </div>
      <div className='grid min-w-0 gap-4 sm:grid-cols-3'>
        <div className='min-w-0'>
          <span className='text-muted-foreground text-xs'>{t('Base URL')}</span>
          <code className='bg-muted mt-1.5 block truncate rounded-lg px-2.5 py-2 text-xs'>
            {props.environment.runtime.baseUrl}
          </code>
        </div>
        <label className='flex min-w-0 flex-col gap-1.5 text-xs font-medium'>
          {t('Model')}
          <Combobox
            options={props.environment.models}
            value={props.environment.runtime.model}
            onValueChange={(value) => {
              if (value) props.environment.setModel(value)
            }}
            placeholder={t('Choose a model')}
            emptyText={t('No compatible models are available')}
            allowCustomValue={false}
            openOnFocus
          />
        </label>
        <label className='flex min-w-0 flex-col gap-1.5 text-xs font-medium'>
          {t('Group')}
          <Combobox
            options={props.environment.groups}
            value={props.environment.runtime.group}
            onValueChange={(value) => {
              if (value) props.environment.setGroup(value)
            }}
            placeholder={t('Choose a group')}
            emptyText={t('No compatible groups are available')}
            allowCustomValue={false}
            openOnFocus
          />
        </label>
      </div>
    </section>
  )
}
