import { useEffect, useState } from 'react'
import { Activity, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getUptimeStatus } from '@/features/dashboard/api'
import { CardState } from './ui/card-state'

function StatusDot({ status }: { status: number }) {
  const color =
    status === 1
      ? 'bg-green-500'
      : status === 0
        ? 'bg-yellow-500'
        : 'bg-red-500'
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />
}

export function UptimePanel() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = () => {
    let mounted = true
    const isInitialLoad = loading

    if (!isInitialLoad) {
      setRefreshing(true)
    }

    getUptimeStatus()
      .then((res) => {
        if (!mounted) return
        setGroups(res?.data || [])
      })
      .catch(() => setGroups([]))
      .finally(() => {
        if (!mounted) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = fetchData()
    return cleanup
  }, [])

  const title = (
    <span className='flex items-center gap-2'>
      <Activity className='h-5 w-5' />
      Uptime
    </span>
  )

  if (loading) {
    return <CardState title={title}>Loading uptime status...</CardState>
  }

  if (!groups.length) {
    return <CardState title={title}>No uptime groups configured.</CardState>
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>{title}</CardTitle>
          <Button
            variant='ghost'
            size='sm'
            onClick={fetchData}
            disabled={refreshing}
            className='h-8 w-8 p-0'
          >
            <RotateCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className='h-80'>
          <div className='space-y-3 pe-4'>
            {groups.map((g) => (
              <div key={g.categoryName} className='space-y-2'>
                <div className='text-sm font-medium'>{g.categoryName}</div>
                <div className='space-y-1'>
                  {g.monitors?.map((m: any) => (
                    <div
                      key={m.name}
                      className='flex items-center justify-between text-sm'
                    >
                      <div className='flex items-center gap-2'>
                        <StatusDot status={m.status} />
                        <span className='truncate'>{m.name}</span>
                        {m.group && (
                          <span className='text-muted-foreground text-xs'>
                            ({m.group})
                          </span>
                        )}
                      </div>
                      <div className='text-muted-foreground'>
                        {((m.uptime ?? 0) * 100).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
