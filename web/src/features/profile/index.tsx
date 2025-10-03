import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { ProfileHeader } from './components/profile-header'
import { ProfileSecurityCard } from './components/profile-security-card'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { TwoFACard } from './components/two-fa-card'
import { useProfile } from './hooks'

// ============================================================================
// Profile Page Component
// ============================================================================

export function Profile() {
  const { profile, loading, refreshProfile } = useProfile()

  return (
    <>
      <AppHeader fixed />
      <Main>
        <div className='space-y-8'>
          {/* Header */}
          <ProfileHeader profile={profile} loading={loading} />

          {/* Content Grid */}
          <div className='grid gap-6 lg:grid-cols-2 lg:items-start'>
            {/* Left Column - Security & 2FA */}
            <div className='space-y-6'>
              <ProfileSecurityCard profile={profile} loading={loading} />
              <TwoFACard loading={loading} />
            </div>

            {/* Right Column - Settings */}
            <ProfileSettingsCard
              profile={profile}
              loading={loading}
              onProfileUpdate={refreshProfile}
            />
          </div>
        </div>
      </Main>
    </>
  )
}
