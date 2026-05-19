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
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface PanelWrapperProps {
  title: ReactNode
  description?: ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  height?: string
  className?: string
  contentClassName?: string
  headerActions?: ReactNode
  variant?: 'default' | 'cockpit'
  children?: ReactNode
}

function PanelHeader(props: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  variant?: 'default' | 'cockpit'
}) {
  const isCockpit = props.variant === 'cockpit'
  const heading = (
    <div className='flex flex-col gap-1'>
      <div
        className={cn('text-sm font-semibold', isCockpit && 'text-slate-100')}
      >
        {props.title}
      </div>
      {props.description != null && (
        <div
          className={cn(
            'text-xs',
            isCockpit ? 'text-slate-400' : 'text-muted-foreground'
          )}
        >
          {props.description}
        </div>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        'border-b px-4 py-3 sm:px-5',
        isCockpit && 'border-white/10'
      )}
    >
      {props.actions != null ? (
        <div className='flex items-start justify-between gap-2'>
          {heading}
          {props.actions}
        </div>
      ) : (
        heading
      )}
    </div>
  )
}

export function PanelWrapper(props: PanelWrapperProps) {
  const { t } = useTranslation()
  const isCockpit = props.variant === 'cockpit'
  const resolvedEmptyMessage = props.emptyMessage ?? t('No data available')
  const height = props.height ?? 'h-64'
  const frameClassName = cn(
    'overflow-hidden rounded-2xl border shadow-xs',
    isCockpit
      ? 'border-violet-500/20 bg-slate-900/60 text-slate-100 shadow-lg shadow-indigo-950/20 backdrop-blur-sm'
      : 'bg-card',
    props.className
  )

  if (props.loading) {
    return (
      <div className={frameClassName}>
        <PanelHeader
          title={props.title}
          description={props.description}
          variant={props.variant}
        />
        <div className={cn('p-4 sm:p-5', props.contentClassName)}>
          <Skeleton
            className={cn(
              'w-full',
              height,
              isCockpit && 'bg-slate-800/60'
            )}
          />
        </div>
      </div>
    )
  }

  if (props.empty) {
    return (
      <div className={frameClassName}>
        <PanelHeader
          title={props.title}
          description={props.description}
          variant={props.variant}
        />
        <div
          className={cn(
            'flex items-center justify-center px-4 text-sm',
            isCockpit ? 'text-slate-400' : 'text-muted-foreground',
            height,
            props.contentClassName
          )}
        >
          {resolvedEmptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div className={frameClassName}>
      <PanelHeader
        title={props.title}
        description={props.description}
        actions={props.headerActions}
        variant={props.variant}
      />
      <div className={cn('p-4 sm:p-5', props.contentClassName)}>
        {props.children}
      </div>
    </div>
  )
}
