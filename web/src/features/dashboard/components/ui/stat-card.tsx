import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  loading?: boolean
  action?: React.ReactNode
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading = false,
  action,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <div className='flex items-center gap-2'>
          {action}
          <Icon className='text-muted-foreground h-4 w-4' />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className='h-8 w-28' />
            <Skeleton className='mt-1 h-4 w-36' />
          </>
        ) : (
          <>
            <div className='text-2xl font-bold'>{value}</div>
            <p className='text-muted-foreground text-xs'>{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
