import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import type { ContentSettings } from '../types'
import { AnnouncementsSection } from './announcements-section'
import { ApiInfoSection } from './api-info-section'
import { ChatSettingsSection } from './chat-settings-section'
import { DashboardSection } from './dashboard-section'
import { DrawingSettingsSection } from './drawing-settings-section'
import { FAQSection } from './faq-section'
import { UptimeKumaSection } from './uptime-kuma-section'

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
  const { openItems, handleAccordionChange } = useAccordionState('content')

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

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <Accordion
          type='multiple'
          value={openItems}
          onValueChange={handleAccordionChange}
          className='space-y-2'
        >
          <DashboardSection
            defaultValues={{
              DataExportEnabled: settings.DataExportEnabled,
              DataExportInterval: settings.DataExportInterval,
              DataExportDefaultTime: settings.DataExportDefaultTime as
                | 'week'
                | 'hour'
                | 'day',
            }}
          />

          <AnnouncementsSection
            enabled={settings['console_setting.announcements_enabled']}
            data={settings['console_setting.announcements']}
          />

          <ApiInfoSection
            enabled={settings['console_setting.api_info_enabled']}
            data={settings['console_setting.api_info']}
          />

          <FAQSection
            enabled={settings['console_setting.faq_enabled']}
            data={settings['console_setting.faq']}
          />

          <UptimeKumaSection
            enabled={settings['console_setting.uptime_kuma_enabled']}
            data={settings['console_setting.uptime_kuma_groups']}
          />

          <ChatSettingsSection defaultValue={settings.Chats} />

          <DrawingSettingsSection
            defaultValues={{
              DrawingEnabled: settings.DrawingEnabled,
              MjNotifyEnabled: settings.MjNotifyEnabled,
              MjAccountFilterEnabled: settings.MjAccountFilterEnabled,
              MjForwardUrlEnabled: settings.MjForwardUrlEnabled,
              MjModeClearEnabled: settings.MjModeClearEnabled,
              MjActionCheckSuccessEnabled: settings.MjActionCheckSuccessEnabled,
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
