import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getUptimeStatus } from '@/features/dashboard/api'

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

  useEffect(() => {
    let mounted = true
    getUptimeStatus()
      .then((res) => {
        if (!mounted) return
        setGroups(res?.data || [])
      })
      .catch(() => setGroups([]))
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card className='col-span-1 lg:col-span-3'>
      <CardHeader>
        <CardTitle>Uptime</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className='h-80'>
          <div className='space-y-3 pe-4'>
            {loading && (
              <div className='text-muted-foreground text-sm'>Loading...</div>
            )}
            {!loading &&
              groups.map((g) => (
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
                          {(m.uptime ?? 0).toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {!loading && !groups.length && (
              <div className='text-muted-foreground text-sm'>
                No uptime groups configured.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
