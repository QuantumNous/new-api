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
import { useHomeCatalog } from '../../hooks'
import { AiClientsSection } from './ai-clients-section'
import { CapabilitiesSection } from './capabilities-section'
import { ConsolePreviewSection } from './console-preview-section'
import { FaqSection } from './faq-section'
import { FeaturedModelsSection } from './featured-models-section'
import { GatewaySection } from './gateway-section'
import { HomeCtaSection } from './home-cta-section'
import { LandingHero } from './landing-hero'
import { PricingPreviewSection } from './pricing-preview-section'

interface DefaultHomeProps {
  isAuthenticated: boolean
}

export function DefaultHome(props: DefaultHomeProps) {
  const catalog = useHomeCatalog()

  return (
    <main>
      <LandingHero
        isAuthenticated={props.isAuthenticated}
        catalogAvailable={catalog.isAvailable}
      />
      <AiClientsSection />
      <FeaturedModelsSection catalogAvailable={catalog.isAvailable} />
      <CapabilitiesSection />
      <ConsolePreviewSection models={catalog.models} />
      <GatewaySection />
      <PricingPreviewSection
        models={catalog.models}
        isLoading={catalog.isLoading}
      />
      <FaqSection />
      <HomeCtaSection isAuthenticated={props.isAuthenticated} />
    </main>
  )
}
