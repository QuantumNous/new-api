import { CommissionSettingsSection } from './commission-settings-section'
import { RulesSection } from './rules-section'
import type { CommissionSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'

const COMMISSION_SECTIONS = [
  {
    id: 'settings',
    titleKey: '返佣设置',
    descriptionKey: '配置返佣总开关、层级、结算与防刷',
    build: (settings: CommissionSettings) => <CommissionSettingsSection defaultValues={settings} />,
  },
  {
    id: 'rules',
    titleKey: '返佣规则',
    descriptionKey: '管理返佣比例、门槛与限额规则',
    build: (settings: CommissionSettings) => <RulesSection maxLevel={settings.CommissionMaxLevel} />,
  },
] as const

export type CommissionSectionId = (typeof COMMISSION_SECTIONS)[number]['id']

const commissionRegistry = createSectionRegistry<CommissionSectionId, CommissionSettings>({
  sections: COMMISSION_SECTIONS,
  defaultSection: 'settings',
  basePath: '/system-settings/commission',
  urlStyle: 'path',
})

export const COMMISSION_SECTION_IDS = commissionRegistry.sectionIds
export const COMMISSION_DEFAULT_SECTION = commissionRegistry.defaultSection
export const getCommissionSectionNavItems = commissionRegistry.getSectionNavItems
export const getCommissionSectionContent = commissionRegistry.getSectionContent
