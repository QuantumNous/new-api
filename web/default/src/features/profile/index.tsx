/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'
import { MOTION_TRANSITION } from '@/lib/motion'
import { useAuthStore } from '@/stores/auth-store'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { DesktopSessionsCard } from './components/desktop-sessions-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PasskeyCard } from './components/passkey-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSecurityCard } from './components/profile-security-card'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { ProfileSectionLabel } from './components/profile-surface'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { TwoFACard } from './components/two-fa-card'
import { useProfile } from './hooks'

function FadeIn(props: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const shouldReduce = useReducedMotion()
  if (shouldReduce) {
    return <div className={props.className}>{props.children}</div>
  }
  return (
    <motion.div
      className={props.className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TRANSITION.default, delay: props.delay ?? 0 }}
    >
      {props.children}
    </motion.div>
  )
}

export function Profile() {
  const { t } = useTranslation()
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
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Profile')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10'>
          <FadeIn>
            <ProfileHeader profile={profile} loading={loading} />
          </FadeIn>

          <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-start lg:gap-8 xl:gap-10'>
            <div className='space-y-8 sm:space-y-10'>
              <FadeIn delay={0.06}>
                <ProfileSettingsCard
                  profile={profile}
                  loading={loading}
                  onProfileUpdate={refreshProfile}
                />
              </FadeIn>

              <FadeIn delay={0.1}>
                <ProfileSecurityCard profile={profile} loading={loading} />
              </FadeIn>

              <FadeIn delay={0.14}>
                <LanguagePreferencesCard
                  profile={profile}
                  onProfileUpdate={refreshProfile}
                />
              </FadeIn>
            </div>

            <aside className='space-y-6 lg:sticky lg:top-6'>
              <FadeIn delay={0.08}>
                <ProfileSectionLabel
                  title={t('Protection')}
                  description={t(
                    'Sign-in methods and devices for this account'
                  )}
                />
                <div className='space-y-3 sm:space-y-4'>
                  <TwoFACard loading={loading} />
                  <PasskeyCard loading={loading} />
                  <DesktopSessionsCard />
                </div>
              </FadeIn>

              {checkinEnabled ? (
                <FadeIn delay={0.12}>
                  <CheckinCalendarCard
                    checkinEnabled={checkinEnabled}
                    turnstileEnabled={turnstileEnabled}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                </FadeIn>
              ) : null}

              {canConfigureSidebar ? (
                <FadeIn delay={0.16}>
                  <SidebarModulesCard />
                </FadeIn>
              ) : null}
            </aside>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
