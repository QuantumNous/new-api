import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { CtaButtons } from '../components/CtaButtons'
import { ChinaGlobalFlow } from '../components/ChinaGlobalFlow'
import { Faq } from '../components/Faq'
import { Hero } from '../components/Hero'
import { ModelGateway } from '../components/ModelGateway'
import { PricingPreview } from '../components/PricingPreview'
import { Section } from '../components/Section'
import { TrustBar } from '../components/TrustBar'
import { UseCases } from '../components/UseCases'
import { marketingNavLinks } from '../data/site'
import { homeContent } from '../data/home'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function Home() {
  const locale = useLocale()
  const c = homeContent[locale]

  useSeo({
    title:
      locale === 'zh'
        ? '元点流商 OriginFlow | 一个 API 连接中国与全球大模型'
        : 'OriginFlow — One API for Chinese & Global AI Models',
    description:
      locale === 'zh'
        ? 'OriginFlow 提供统一的 AI API 网关，接入中国与海外大模型，兼容 OpenAI 协议。'
        : 'OriginFlow is an AI API gateway connecting Chinese and global models through one OpenAI-compatible API.',
  })

  return (
    <PublicLayout
      showMainContainer={false}
      navLinks={marketingNavLinks[locale]}
      showAuthButtons
      showThemeSwitch
    >
      <div className='pt-16'>
        <Section>
          <Hero content={c.hero} />
        </Section>
        <Section className='!py-8'>
          <TrustBar items={c.trustBar} />
        </Section>
        <ModelGateway content={c.modelGateway} />
        <ChinaGlobalFlow content={c.flow} />
        <UseCases content={c.useCases} />
        <PricingPreview content={c.pricingPreview} />
        <Faq title={c.faq.title} items={c.faq.items} />
        <Section dark>
          <div className='mx-auto max-w-2xl text-center'>
            <h2 className='text-3xl font-bold text-foreground'>{c.cta.title}</h2>
            <p className='mt-4 text-[#94A3B8]'>{c.cta.description}</p>
            <div className='mt-8 flex justify-center'>
              <CtaButtons primary={c.cta.primaryCta} secondary={c.cta.secondaryCta} />
            </div>
          </div>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
