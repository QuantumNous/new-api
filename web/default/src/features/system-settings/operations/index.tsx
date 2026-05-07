import { useMemo } from 'react'
import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import type { OperationsSettings } from '../types'
import {
  OPERATIONS_DEFAULT_SECTION,
  getOperationsSectionContent,
} from './section-registry.tsx'

const defaultOperationsSettings: OperationsSettings = {
  RetryTimes: 0,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  ChannelDisableThreshold: '',
  QuotaRemindThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPForceAuthLogin: false,
  WorkerUrl: '',
  WorkerValidKey: '',
  WorkerAllowHttpImageRequestEnabled: false,
  LogConsumeEnabled: false,
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
  'perf_metrics_setting.enabled': true,
  'perf_metrics_setting.flush_interval': 5,
  'perf_metrics_setting.bucket_time': 'hour',
  'perf_metrics_setting.retention_days': 0,
}

export function OperationsSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const { status } = useStatus()
  const params = useParams({
    from: '/_authenticated/system-settings/operations/$section',
  })

  const settings = useMemo(
    () => getOptionValue(data?.data, defaultOperationsSettings),
    [data?.data]
  )

  if (isLoading) {
    return (
      <div className='text-muted-foreground flex h-full w-full flex-1 items-center justify-center'>
        {t('Loading maintenance settings...')}
      </div>
    )
  }

  const activeSection = (params?.section ?? OPERATIONS_DEFAULT_SECTION) as
    | 'behavior'
    | 'monitoring'
    | 'email'
    | 'worker'
    | 'logs'
    | 'performance'
    | 'update-checker'
  const sectionContent = getOperationsSectionContent(
    activeSection,
    settings,
    status?.version as string | undefined,
    status?.start_time as number | null | undefined
  )

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className='space-y-4'>{sectionContent}</div>
      </div>
    </div>
  )
}
