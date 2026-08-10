import { PublicLayout } from '@/components/layout/components/public-layout'
import { useAuthStore } from '@/stores/auth-store'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import {
  ChinaGlobalFlow,
  Faq,
  FooterCta,
  Hero,
  ModelGateway,
  TrustBar,
  UseCases,
} from '../components/MarketingSections'

export function MarketingHome() {
  const c = useSiteContent()
  const isAuthenticated = !!useAuthStore((s) => s.auth.user)
  return (
    <PublicLayout
      navLinks={useMarketingNavLinks()}
      showAuthButtons
      showThemeSwitch
      siteName={c.hero.title}
    >
      <Hero />
      <TrustBar />
      <ModelGateway />
      <ChinaGlobalFlow />
      <UseCases />
      {isAuthenticated && (
        <div className='px-4 pb-4 text-center'>
          <a
            href='/dashboard'
            className='text-sm text-[#4F8CFF] hover:underline'
          >
            {c.footerCta.cta} →
          </a>
        </div>
      )}
      <Faq />
      <FooterCta />
    </PublicLayout>
  )
}
