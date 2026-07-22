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
import { CodeSamplesCard } from './code-samples-card'
import { DashboardHero } from './dashboard-hero'
import { FeatureCards } from './feature-cards'
import { LegacyStatusSection } from './legacy-status-section'
import { PricingCards } from './pricing-cards'
import { ProviderGrid } from './provider-grid'
import { QuickStartTimeline } from './quick-start-timeline'
import { RealtimeUsageCard } from './realtime-usage-card'

/**
 * Dashboard overview — the marketing-style "Milky Hub" home screen for
 * logged-in users. Combines a hero, model providers, realtime usage,
 * code samples, feature highlights, pricing plans and a quick-start
 * timeline. The legacy admin/health panels remain available via the
 * collapsible "System status" section at the bottom.
 */
export function OverviewDashboard() {
  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      <DashboardHero />
      <ProviderGrid />
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
        <RealtimeUsageCard />
        <CodeSamplesCard />
      </div>
      <FeatureCards />
      <PricingCards />
      <QuickStartTimeline />
      <LegacyStatusSection />
    </div>
  )
}
