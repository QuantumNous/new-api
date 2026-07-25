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
import type { ReactNode } from 'react'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { SectionPageLayout } from '@/components/layout'
import { OperationDocumentationLink } from '@/components/operation-documentation-link'
import { ModelAccessBrowser } from './components/model-access-browser'
import { useModelAccess } from './hooks/use-model-access'

export type AvailableModelsViewState =
  | 'loading'
  | 'error'
  | 'data'
  | 'data-with-refetch-error'

// eslint-disable-next-line react-refresh/only-export-components
export function getAvailableModelsViewState(options: {
  hasData: boolean
  isError: boolean
  isLoading: boolean
}): AvailableModelsViewState {
  if (options.hasData) {
    return options.isError ? 'data-with-refetch-error' : 'data'
  }
  return options.isLoading ? 'loading' : 'error'
}

function ModelAccessSkeleton() {
  return (
    <div className='mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]'>
      <div className='hidden flex-col gap-2 lg:flex'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-36 w-full rounded-xl' />
        <Skeleton className='h-36 w-full rounded-xl' />
      </div>
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-8 w-full rounded-lg lg:hidden' />
        <Skeleton className='h-24 w-full rounded-xl' />
        <Skeleton className='h-24 w-full rounded-xl' />
        <Skeleton className='h-24 w-full rounded-xl' />
        <Skeleton className='h-24 w-full rounded-xl' />
      </div>
    </div>
  )
}

export function AvailableModels() {
  const { t } = useTranslation()
  const modelAccessQuery = useModelAccess()
  const viewState = getAvailableModelsViewState({
    hasData: modelAccessQuery.data !== undefined,
    isError: modelAccessQuery.isError,
    isLoading: modelAccessQuery.isLoading,
  })
  let content: ReactNode

  if (viewState === 'loading') {
    content = <ModelAccessSkeleton />
  } else if (viewState === 'error' || !modelAccessQuery.data) {
    content = (
      <Alert variant='destructive'>
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden='true' />
        <AlertTitle>{t('Unable to load available models')}</AlertTitle>
        <AlertDescription>{t('Request failed')}</AlertDescription>
        <AlertAction>
          <Button
            size='sm'
            variant='outline'
            disabled={modelAccessQuery.isFetching}
            onClick={() => void modelAccessQuery.refetch()}
          >
            {modelAccessQuery.isFetching && (
              <Spinner data-icon='inline-start' />
            )}
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  } else {
    content = (
      <div className='flex flex-col gap-4'>
        {viewState === 'data-with-refetch-error' && (
          <Alert>
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
            <AlertTitle>{t('Unable to load available models')}</AlertTitle>
            <AlertDescription>{t('Request failed')}</AlertDescription>
            <AlertAction>
              <Button
                size='sm'
                variant='outline'
                disabled={modelAccessQuery.isFetching}
                onClick={() => void modelAccessQuery.refetch()}
              >
                {modelAccessQuery.isFetching && (
                  <Spinner data-icon='inline-start' />
                )}
                {t('Retry')}
              </Button>
            </AlertAction>
          </Alert>
        )}
        <ModelAccessBrowser access={modelAccessQuery.data} />
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='mx-auto block w-full max-w-7xl'>
          {t('Available Models')}
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <OperationDocumentationLink />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>{content}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
