import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card'

type TitledCardProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  iconClassName?: string
  titleClassName?: string
  descriptionClassName?: string
}

export function TitledCard({
  title,
  description,
  icon,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
  iconClassName,
  titleClassName,
  descriptionClassName,
}: TitledCardProps) {
  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      <CardHeader
        className={cn('border-b p-3 !pb-3 sm:p-5 sm:!pb-5', headerClassName)}
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex min-w-0 items-center gap-3'>
            {icon != null && (
              <div
                className={cn(
                  'bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9',
                  iconClassName
                )}
              >
                {icon}
              </div>
            )}
            <div className='min-w-0'>
              <CardTitle
                className={cn(
                  'text-lg tracking-tight sm:text-xl',
                  titleClassName
                )}
              >
                {title}
              </CardTitle>
              {description != null && (
                <CardDescription
                  className={cn('text-xs sm:text-sm', descriptionClassName)}
                >
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {action != null && (
            <div className='w-full shrink-0 sm:w-auto'>{action}</div>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('p-3 sm:p-5', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
