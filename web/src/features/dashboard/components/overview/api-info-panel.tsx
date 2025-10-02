import { useState, useCallback } from 'react'
import { Route } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import {
  testUrlLatency,
  getDefaultPingStatus,
} from '@/features/dashboard/lib/api-info'
import type { PingStatusMap, ApiInfoItem } from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'
import { ApiInfoItemComponent } from './api-info-item'

export function ApiInfoPanel() {
  const { items: list, loading } = useApiInfo()
  const [pingStatus, setPingStatus] = useState<PingStatusMap>({})

  // 测速函数
  const handleTest = useCallback(async (url: string) => {
    setPingStatus((prev) => ({
      ...prev,
      [url]: { latency: null, testing: true, error: false },
    }))

    const result = await testUrlLatency(url)
    setPingStatus((prev) => ({ ...prev, [url]: result }))
  }, [])

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Route className='h-5 w-5' />
          API Info
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage='No API routes configured'
      height='h-64'
    >
      <ScrollArea className='h-64'>
        <div className='space-y-0 pe-4'>
          {list.map((item: ApiInfoItem, idx: number) => (
            <ApiInfoItemComponent
              key={idx}
              item={item}
              status={pingStatus[item.url] || getDefaultPingStatus()}
              onTest={handleTest}
            />
          ))}
        </div>
      </ScrollArea>
    </PanelWrapper>
  )
}
