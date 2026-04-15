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
    <div className='group flex flex-col gap-1.5 py-3'>
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase'>
          <Icon className='text-muted-foreground/60 size-3.5' />
          {props.title}
        </div>
        {props.action}
      </div>

      {props.loading ? (
        <div className='space-y-1.5'>
          <Skeleton className='h-7 w-24' />
          <Skeleton className='h-3.5 w-32' />
        </div>
      ) : props.error ? (
        <>
          <div className='text-muted-foreground font-mono text-2xl font-bold tracking-tight tabular-nums'>
            --
          </div>
          <p className='text-muted-foreground/60 text-xs'>
            {props.description}
          </p>
        </>
      ) : (
        <>
          <div className='text-foreground font-mono text-2xl font-bold tracking-tight tabular-nums'>
            {props.value}
          </div>
          <p className='text-muted-foreground/60 text-xs'>
            {props.description}
          </p>
        </>
      )}
    </div>
  )
}
