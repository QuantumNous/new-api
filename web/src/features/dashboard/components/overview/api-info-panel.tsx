import { useState, useEffect, useCallback } from 'react'
import { Route } from 'lucide-react'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import type { PingStatusMap, ApiInfoItem } from '@/features/dashboard/types'
import {
  testUrlLatency,
  copyToClipboard,
  getDefaultPingStatus,
} from '@/features/dashboard/utils/api-info'
import { InfoPanel } from '../ui/info-panel'
import { ApiInfoItemComponent } from './api-info-item'

export function ApiInfoPanel() {
  const { items: list } = useApiInfo()
  const [pingStatus, setPingStatus] = useState<PingStatusMap>({})
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  // 测速函数
  const handleTest = useCallback(async (url: string) => {
    setPingStatus((prev) => ({
      ...prev,
      [url]: { latency: null, testing: true, error: false },
    }))

    const result = await testUrlLatency(url)
    setPingStatus((prev) => ({ ...prev, [url]: result }))
  }, [])

  // 复制 URL
  const handleCopy = useCallback(async (url: string) => {
    const success = await copyToClipboard(url)
    if (success) {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    }
  }, [])

  // 自动测速
  useEffect(() => {
    if (list && list.length > 0) {
      list.forEach((item: ApiInfoItem) => {
        if (item.url) {
          handleTest(item.url)
        }
      })
    }
  }, [list, handleTest])

  return (
    <InfoPanel
      title={
        <span className='flex items-center gap-2'>
          <Route className='h-5 w-5' />
          API Info
        </span>
      }
      items={list}
      emptyMessage='No API routes configured.'
      renderItem={(item: ApiInfoItem, idx: number) => (
        <ApiInfoItemComponent
          key={idx}
          item={item}
          status={pingStatus[item.url] || getDefaultPingStatus()}
          isCopied={copiedUrl === item.url}
          onTest={handleTest}
          onCopy={handleCopy}
        />
      )}
    />
  )
}
