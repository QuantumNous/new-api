import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  image: React.ComponentType<React.SVGProps<SVGSVGElement>>
  name: string
  version?: string
  width?: number
  height?: number
  showName?: boolean
  badge?: string
}

export function Logo({
  className,
  image: SvgImage,
  name,
  version,
  width = 24,
  height = 24,
  showName = true,
  badge,
  ...props
}: LogoProps) {
  return (
    <div
      data-slot='logo'
      className={cn('flex items-center gap-2 text-sm font-medium', className)}
      {...props}
    >
      <SvgImage
        width={width}
        height={height}
        aria-hidden='true'
        className='max-h-full max-w-full opacity-70'
      />
      <span className={cn(!showName && 'sr-only')}>{name}</span>
      {version && <span className='text-muted-foreground'>{version}</span>}
      {badge && <Badge variant='secondary'>{badge}</Badge>}
    </div>
  )
}
