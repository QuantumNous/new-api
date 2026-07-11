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
/* eslint-disable react-refresh/only-export-components */
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

export type StatusVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive'

export type StatusBadgeAppearance = 'soft' | 'outline' | 'plain'

export const StatusBadgeAppearanceContext =
  React.createContext<StatusBadgeAppearance | null>(null)

export const statusBadgeVariants = cva(
  'focus-visible:ring-ring/50 inline-flex w-fit max-w-none shrink-0 items-center justify-center overflow-visible rounded-md whitespace-nowrap font-medium tracking-normal outline-none transition-[color,background-color,border-color,filter] duration-150 focus-visible:ring-[3px] has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&_.truncate]:max-w-none [&_.truncate]:overflow-visible [&_.truncate]:text-clip [&_.truncate]:whitespace-nowrap [&_[data-icon]]:pointer-events-none [&_[data-icon]]:size-3 [&_[data-icon]]:shrink-0',
  {
    variants: {
      size: {
        sm: 'h-5 gap-1 px-1.5 text-xs leading-none',
        md: 'h-6 gap-1.5 px-2 text-sm leading-none',
      },
      variant: {
        neutral: 'text-muted-foreground',
        info: 'text-status-info',
        success: 'text-status-success',
        warning: 'text-status-warning',
        destructive: 'text-status-destructive',
      },
      appearance: {
        soft: 'border',
        outline: 'border bg-transparent',
        plain:
          'h-auto rounded-none border-0 bg-transparent px-0 py-0 shadow-none',
      },
    },
    compoundVariants: [
      {
        variant: 'neutral',
        appearance: 'soft',
        className: 'border-border/60 bg-muted/40',
      },
      {
        variant: 'info',
        appearance: 'soft',
        className: 'border-info/25 bg-info/10',
      },
      {
        variant: 'success',
        appearance: 'soft',
        className: 'border-success/25 bg-success/10',
      },
      {
        variant: 'warning',
        appearance: 'soft',
        className: 'border-warning/30 bg-warning/10',
      },
      {
        variant: 'destructive',
        appearance: 'soft',
        className: 'border-destructive/25 bg-destructive/10',
      },
      {
        variant: 'neutral',
        appearance: 'outline',
        className: 'border-border',
      },
      {
        variant: 'info',
        appearance: 'outline',
        className: 'border-info/40',
      },
      {
        variant: 'success',
        appearance: 'outline',
        className: 'border-success/40',
      },
      {
        variant: 'warning',
        appearance: 'outline',
        className: 'border-warning/45',
      },
      {
        variant: 'destructive',
        appearance: 'outline',
        className: 'border-destructive/40',
      },
    ],
    defaultVariants: {
      appearance: 'plain',
      size: 'sm',
      variant: 'neutral',
    },
  }
)

export type StatusBadgeProps = useRender.ComponentProps<'span'> &
  VariantProps<typeof statusBadgeVariants>

export function StatusBadge({
  appearance: appearanceProp,
  children,
  className,
  render,
  size: sizeProp,
  variant: variantProp,
  ...props
}: StatusBadgeProps) {
  const contextAppearance = React.useContext(StatusBadgeAppearanceContext)
  const appearance = appearanceProp ?? contextAppearance ?? 'plain'
  const size = sizeProp ?? 'sm'
  const variant = variantProp ?? 'neutral'
  const leadingIcons: React.ReactNode[] = []
  const trailingIcons: React.ReactNode[] = []
  const labelChildren: React.ReactNode[] = []

  for (const child of React.Children.toArray(children)) {
    if (React.isValidElement<{ 'data-icon'?: string }>(child)) {
      const iconPlacement = child.props['data-icon']
      if (iconPlacement === 'inline-start') {
        leadingIcons.push(child)
        continue
      }
      if (iconPlacement === 'inline-end') {
        trailingIcons.push(child)
        continue
      }
    }
    labelChildren.push(child)
  }

  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(
          statusBadgeVariants({ appearance, size, variant }),
          className
        ),
        children: (
          <>
            {leadingIcons}
            {labelChildren.length > 0 && (
              <span
                data-slot='status-badge-label'
                className='max-w-none shrink-0 overflow-visible whitespace-nowrap'
              >
                {labelChildren}
              </span>
            )}
            {trailingIcons}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      appearance,
      size,
      slot: 'status-badge',
      variant,
    },
  })
}

export type CopyableStatusBadgeProps = Omit<
  StatusBadgeProps,
  'onClick' | 'render'
> & {
  value: string
}

export function CopyableStatusBadge({
  'aria-label': ariaLabel,
  children,
  className,
  value,
  ...props
}: CopyableStatusBadgeProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()

  return (
    <StatusBadge
      {...props}
      render={<button type='button' />}
      className={cn('cursor-copy hover:brightness-95', className)}
      aria-label={ariaLabel ?? `${t('Copy')}: ${value}`}
      title={t('Copy to clipboard')}
      onClick={(event) => {
        event.stopPropagation()
        void copyToClipboard(value)
      }}
    >
      {children}
    </StatusBadge>
  )
}

export interface StatusBadgeListProps<T> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  empty?: React.ReactNode
  getKey?: (item: T, index: number) => React.Key
  items: T[]
  max?: number
  moreLabel?: (remaining: number) => string
  renderItem: (item: T, index: number) => React.ReactNode
}

export function StatusBadgeList<T>(props: StatusBadgeListProps<T>) {
  const {
    className,
    empty = <span className='text-muted-foreground text-xs'>-</span>,
    getKey,
    items,
    max = 2,
    moreLabel,
    renderItem,
    ...domProps
  } = props

  if (items.length === 0) return empty

  const displayed = items.slice(0, max)
  const remaining = items.length - max

  return (
    <div
      className={cn(
        'flex max-w-full min-w-0 items-center gap-1 overflow-visible',
        className
      )}
      {...domProps}
    >
      {displayed.map((item, index) => (
        <React.Fragment key={getKey?.(item, index) ?? index}>
          {renderItem(item, index)}
        </React.Fragment>
      ))}
      {remaining > 0 && (
        <StatusBadge className='shrink-0'>
          {moreLabel?.(remaining) ?? `+${remaining}`}
        </StatusBadge>
      )}
    </div>
  )
}
