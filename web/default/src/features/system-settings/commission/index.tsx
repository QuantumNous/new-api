import { SettingsPage } from '../components/settings-page'
import type { CommissionSettings } from '../types'
import { COMMISSION_DEFAULT_SECTION, getCommissionSectionContent } from './section-registry'

const defaultCommissionSettings: CommissionSettings = {
  CommissionEnabled: false,
  CommissionMaxLevel: 3,
  CommissionRealTimeSettleEnabled: true,
  CommissionAntiSpamEnabled: true,
  CommissionMaxDailyInvites: 50,
  CommissionSameIPLimit: 5,
  CommissionGlobalIPLimit: 10,
}

export function CommissionSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/commission/$section'
      defaultSettings={defaultCommissionSettings}
      defaultSection={COMMISSION_DEFAULT_SECTION}
      getSectionContent={getCommissionSectionContent}
    />
  )
}
