import { useState, useCallback } from 'react'
import { Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { items: list, loading } = useApiInfo()
  const [pingStatus, setPingStatus] = useState<PingStatusMap>({})

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
          <Route className='text-muted-foreground/60 size-4' />
          {t('API Info')}
        </span>
      }
      loading={loading}
      empty={!list.length}
      emptyMessage={t('No API routes configured')}
      height='h-56 sm:h-64'
    >
      <ScrollArea className='h-56 sm:h-64'>
        <div className='-mx-3 sm:-mx-5'>
          {list.map((item: ApiInfoItem, idx: number) => (
            <div
              key={item.url}
              className={
                idx < list.length - 1 ? 'border-border/60 border-b' : ''
              }
            >
              <ApiInfoItemComponent
                item={item}
                status={pingStatus[item.url] || getDefaultPingStatus()}
                onTest={handleTest}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </PanelWrapper>
  )
}
