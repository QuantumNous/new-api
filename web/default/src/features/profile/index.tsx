import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import { AppHeader, Main } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PasskeyCard } from './components/passkey-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSecurityCard } from './components/profile-security-card'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { TwoFACard } from './components/two-fa-card'
import { useProfile } from './hooks'

export function Profile() {
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings !== false

  return (
    <>
      <AppHeader />
      <Main>
        <div className='min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4 sm:py-6'>
          <CardStaggerContainer className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6'>
            <CardStaggerItem>
              <ProfileHeader profile={profile} loading={loading} />
            </CardStaggerItem>

            <CardStaggerItem>
              <div className='grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.46fr)] xl:items-start'>
                <div className='space-y-4 sm:space-y-6'>
                  <ProfileSettingsCard
                    profile={profile}
                    loading={loading}
                    onProfileUpdate={refreshProfile}
                  />
                  <LanguagePreferencesCard
                    profile={profile}
                    onProfileUpdate={refreshProfile}
                  />
                  <ProfileSecurityCard profile={profile} loading={loading} />
                </div>

                <div className='space-y-4 sm:space-y-6 xl:sticky xl:top-6'>
                  {checkinEnabled && (
                    <CheckinCalendarCard
                      checkinEnabled={checkinEnabled}
                      turnstileEnabled={turnstileEnabled}
                      turnstileSiteKey={turnstileSiteKey}
                    />
                  )}
                  {canConfigureSidebar && <SidebarModulesCard />}
                  <PasskeyCard loading={loading} />
                  <TwoFACard loading={loading} />
                </div>
              </div>
            </CardStaggerItem>
          </CardStaggerContainer>
        </div>
      </Main>
    </>
  )
}
