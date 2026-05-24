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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { NotificationDialog } from '@/components/notification-dialog'
import { AnnouncementStrip } from './announcement-strip'
import { DeveloperSection } from './developer-section'
import { HomeFooter } from './footer-section'
import { HeroSection, WhySection } from './hero-section'
import {
  healthLabelClass,
  useCopyToast,
  useHomeAnnouncement,
  useHomeModelStatus,
  useScrollReveal,
  useStaticHomeTheme,
} from './hooks'
import { HomeNav } from './nav'
import { MetricsSection, PricingSection, StartJourney } from './pricing-section'
import { EndpointStrip, ModelStatusSection } from './status-section'
import { useStaticHomeText } from './translations'
import './static-home-base.css'
import './static-home-hero.css'
import './static-home-sections.css'
import './static-home-footer.css'

export { healthLabelClass }

export function StaticHomePage() {
  const t = useStaticHomeText()
  const { i18n } = useTranslation()
  const { auth } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useStaticHomeTheme()
  const copyToast = useCopyToast()
  const announcement = useHomeAnnouncement()
  const models = useHomeModelStatus()

  useScrollReveal()

  const primaryHref = auth.user ? '/console' : '/sign-up'

  return (
    <main className='static-home' data-theme={theme.theme} id='top'>
      <span
        className={cn('static-home__theme-reveal', theme.animating && 'is-active')}
        data-reveal-theme={theme.revealTheme}
        aria-hidden='true'
      />
      <HomeNav
        announcement={announcement}
        isDark={theme.isDark}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        t={t}
        toggleTheme={theme.toggleTheme}
      />
      <div className='static-home__frame'>
        <AnnouncementStrip announcement={announcement} t={t} />
        <HeroSection primaryHref={primaryHref} t={t} />
        <WhySection t={t} />
        <EndpointStrip copyToast={copyToast} t={t} />
        <ModelStatusSection models={models} t={t} />
        <DeveloperSection copyToast={copyToast} t={t} />
        <PricingSection t={t} />
        <MetricsSection t={t} />
        <StartJourney primaryHref={primaryHref} t={t} />
        <HomeFooter language={i18n.language} t={t} />
      </div>
      <HomeNotificationDialog announcement={announcement} />
      {copyToast.message && (
        <div className='static-home__toast' role='status'>
          {copyToast.message}
        </div>
      )}
    </main>
  )
}

function HomeNotificationDialog({
  announcement,
}: {
  announcement: ReturnType<typeof useHomeAnnouncement>
}) {
  const notifications = announcement.notifications

  if (!notifications.dialogOpen) return null

  return (
    <NotificationDialog
      open={notifications.dialogOpen}
      onOpenChange={notifications.setDialogOpen}
      activeTab={notifications.activeTab}
      onTabChange={notifications.setActiveTab}
      notice={notifications.notice}
      announcements={notifications.announcements}
      loading={notifications.loading}
      onCloseToday={notifications.closeToday}
    />
  )
}
