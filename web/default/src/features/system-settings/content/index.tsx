import { useMemo } from 'react'
import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import type { ContentSettings } from '../types'
import {
  CONTENT_DEFAULT_SECTION,
  getContentSectionContent,
} from './section-registry.tsx'

const defaultContentSettings: ContentSettings = {
  'console_setting.api_info': '[]',
  'console_setting.announcements': '[]',
  'console_setting.faq': '[]',
  'console_setting.uptime_kuma_groups': '[]',
  'console_setting.api_info_enabled': true,
  'console_setting.announcements_enabled': true,
  'console_setting.faq_enabled': true,
  'console_setting.uptime_kuma_enabled': false,
  DataExportEnabled: false,
  DataExportDefaultTime: 'hour',
  DataExportInterval: 5,
  Chats: '[]',
  DrawingEnabled: false,
  MjNotifyEnabled: false,
  MjAccountFilterEnabled: false,
  MjForwardUrlEnabled: false,
  MjModeClearEnabled: false,
  MjActionCheckSuccessEnabled: false,
}

export function ContentSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const params = useParams({
    from: '/_authenticated/system-settings/content/$section',
  })

  const settings = useMemo(() => {
    const resolved = getOptionValue(data?.data, defaultContentSettings)

    const optionMap = new Map(
      (data?.data ?? []).map((item) => [item.key, item.value])
    )

    if (!optionMap.has('console_setting.announcements')) {
      const legacy = optionMap.get('Announcements')
      if (legacy !== undefined) {
        resolved['console_setting.announcements'] = legacy
      }
    }

    if (!optionMap.has('console_setting.api_info')) {
      const legacy = optionMap.get('ApiInfo')
      if (legacy !== undefined) {
        resolved['console_setting.api_info'] = legacy
      }
    }

    if (!optionMap.has('console_setting.faq')) {
      const legacy = optionMap.get('FAQ')
      if (legacy !== undefined) {
        resolved['console_setting.faq'] = legacy
      }
    }

    if (!optionMap.has('console_setting.uptime_kuma_groups')) {
      const legacyUrl = optionMap.get('UptimeKumaUrl')
      const legacySlug = optionMap.get('UptimeKumaSlug')
      if (legacyUrl && legacySlug) {
        resolved['console_setting.uptime_kuma_groups'] = JSON.stringify([
          {
            id: 1,
            categoryName: 'Legacy',
            url: legacyUrl,
            slug: legacySlug,
          },
        ])
      }
    }

    return resolved
  }, [data?.data])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>
          {t('Loading content settings...')}
        </div>
      </div>
    )
  }

  const activeSection = (params?.section ?? CONTENT_DEFAULT_SECTION) as
    | 'dashboard'
    | 'announcements'
    | 'api-info'
    | 'faq'
    | 'uptime-kuma'
    | 'chat'
    | 'drawing'
  const sectionContent = getContentSectionContent(activeSection, settings)

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className='space-y-4'>{sectionContent}</div>
      </div>
    </div>
  )
}
