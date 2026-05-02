import { type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  loading?: boolean
  error?: boolean
  action?: React.ReactNode
}

export function StatCard(props: StatCardProps) {
  const Icon = props.icon

  return (
    <div className='group flex flex-col gap-1'>
      <div className='flex items-start justify-between gap-1'>
        <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase sm:gap-2'>
          <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
          <span className='line-clamp-2 leading-snug'>{props.title}</span>
        </div>
        {props.action && (
          <div className='shrink-0'>{props.action}</div>
        )}
      </div>

      {props.loading ? (
        <div className='space-y-1.5'>
          <Skeleton className='h-7 w-24' />
          <Skeleton className='h-3.5 w-32' />
        </div>
      ) : props.error ? (
        <>
          <div className='text-muted-foreground mt-0.5 font-mono text-base font-bold tracking-tight break-all tabular-nums sm:text-2xl'>
            --
          </div>
          <p className='text-muted-foreground/60 hidden text-xs md:block'>
            {props.description}
          </p>
        </>
      ) : (
        <>
          <div className='text-foreground mt-0.5 font-mono text-base font-bold tracking-tight break-all tabular-nums sm:text-2xl'>
            {props.value}
          </div>
          <p className='text-muted-foreground/60 hidden text-xs md:block'>
            {props.description}
          </p>
        </>
      )}
    </div>
  )
}
