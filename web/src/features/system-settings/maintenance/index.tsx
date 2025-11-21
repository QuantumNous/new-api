import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  parseHeaderNavModules,
  parseSidebarModulesAdmin,
  serializeHeaderNavModules,
  serializeSidebarModulesAdmin,
} from './config'
import { HeaderNavigationSection } from './header-navigation-section'
import { LogSettingsSection } from './log-settings-section'
import { NoticeSection } from './notice-section'
import { SidebarModulesSection } from './sidebar-modules-section'
import { UpdateCheckerSection } from './update-checker-section'

export function MaintenanceSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } = useAccordionState('maintenance')
  const { status } = useStatus()

  const settings = useMemo(
    () => getOptionValue(data?.data, DEFAULT_MAINTENANCE_SETTINGS),
    [data?.data]
  )

  const headerNavConfig = useMemo(
    () => parseHeaderNavModules(settings.HeaderNavModules),
    [settings.HeaderNavModules]
  )

  const sidebarConfig = useMemo(
    () => parseSidebarModulesAdmin(settings.SidebarModulesAdmin),
    [settings.SidebarModulesAdmin]
  )

  const headerNavSerialized = useMemo(
    () => serializeHeaderNavModules(headerNavConfig),
    [headerNavConfig]
  )

  const sidebarSerialized = useMemo(
    () => serializeSidebarModulesAdmin(sidebarConfig),
    [sidebarConfig]
  )

  if (isLoading) {
    return (
      <div className='text-muted-foreground flex h-full w-full flex-1 items-center justify-center'>
        {t('Loading maintenance settings...')}
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
          <UpdateCheckerSection
            currentVersion={status?.version}
            startTime={status?.start_time}
          />

          <NoticeSection defaultValue={settings.Notice ?? ''} />

          <LogSettingsSection
            defaultEnabled={Boolean(settings.LogConsumeEnabled)}
          />

          <HeaderNavigationSection
            config={headerNavConfig}
            initialSerialized={headerNavSerialized}
          />

          <SidebarModulesSection
            config={sidebarConfig}
            initialSerialized={sidebarSerialized}
          />
        </Accordion>
      </div>
    </div>
  )
}
