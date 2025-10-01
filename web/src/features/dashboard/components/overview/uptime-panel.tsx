import { useEffect, useState } from 'react'
import { Activity, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getUptimeStatus } from '@/features/dashboard/api'
import { PanelWrapper } from '../ui/panel-wrapper'

function StatusDot({ status }: { status: number }) {
  const color =
    status === 1
      ? 'bg-emerald-500'
      : status === 0
        ? 'bg-amber-500'
        : 'bg-rose-500'
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

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Activity className='h-5 w-5' />
          Uptime
        </span>
      }
      loading={loading}
      empty={!groups.length}
      emptyMessage='No uptime monitoring configured'
      height='h-80'
      headerActions={
        <Button
          variant='ghost'
          size='sm'
          onClick={fetchData}
          disabled={refreshing}
          className='h-8 w-8 p-0'
        >
          <RotateCw
            className={cn('h-4 w-4', refreshing && 'animate-spin')}
            aria-label='Refresh'
          />
        </Button>
      }
    >
      <ScrollArea className='h-80'>
        <div className='space-y-4 pe-4'>
          {groups.map((group, groupIdx) => (
            <div key={group.categoryName}>
              <div className='mb-3 flex items-center gap-2'>
                <h4 className='text-sm font-semibold'>{group.categoryName}</h4>
                <Badge variant='secondary' className='h-5 text-xs'>
                  {group.monitors?.length || 0}
                </Badge>
              </div>
              <div className='space-y-0'>
                {group.monitors?.map((monitor: any, monitorIdx: number) => (
                  <div key={monitor.name}>
                    <div className='group hover:bg-accent/50 -mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors'>
                      <div className='flex min-w-0 items-center gap-2.5'>
                        <StatusDot status={monitor.status} />
                        <span className='truncate text-sm'>{monitor.name}</span>
                        {monitor.group && (
                          <span className='text-muted-foreground shrink-0 text-xs'>
                            ({monitor.group})
                          </span>
                        )}
                      </div>
                      <span className='text-muted-foreground shrink-0 text-sm font-medium tabular-nums'>
                        {((monitor.uptime ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                    {monitorIdx < (group.monitors?.length || 0) - 1 && (
                      <Separator className='my-0' />
                    )}
                  </div>
                ))}
              </div>
              {groupIdx < groups.length - 1 && <Separator className='my-4' />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </PanelWrapper>
  )
}
