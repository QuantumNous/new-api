import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'

interface PanelWrapperProps {
  title: ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  height?: string
  headerActions?: ReactNode
  children?: ReactNode
}

export function PanelWrapper(props: PanelWrapperProps) {
  const { t } = useTranslation()
  const resolvedEmptyMessage = props.emptyMessage ?? t('No data available')
  const height = props.height ?? 'h-64'

  if (props.loading) {
    return (
      <div className='overflow-hidden rounded-lg border'>
        <div className='border-b px-3 py-2.5 sm:px-5 sm:py-3'>
          <div className='text-sm font-semibold'>{props.title}</div>
        </div>
        <div className='p-3 sm:p-5'>
          <Skeleton className={`w-full ${height}`} />
        </div>
      </div>
    )
  }

  if (props.empty) {
    return (
      <div className='overflow-hidden rounded-lg border'>
        <div className='border-b px-3 py-2.5 sm:px-5 sm:py-3'>
          <div className='text-sm font-semibold'>{props.title}</div>
        </div>
        <div
          className={`text-muted-foreground flex items-center justify-center text-sm ${height}`}
        >
          {resolvedEmptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='border-b px-3 py-2.5 sm:px-5 sm:py-3'>
        {props.headerActions ? (
          <div className='flex items-center justify-between gap-2'>
            <div className='text-sm font-semibold'>{props.title}</div>
            {props.headerActions}
          </div>
        ) : (
          <div className='text-sm font-semibold'>{props.title}</div>
        )}
      </div>
      <div className='p-3 sm:p-5'>{props.children}</div>
    </div>
  )
}
