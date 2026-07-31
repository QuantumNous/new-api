import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { ContactForm } from '../components/ContactForm'
import { Section, SectionTitle } from '../components/Section'
import { marketingNavLinks } from '../data/site'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function ContactSales() {
  const locale = useLocale()
  useSeo({
    title: locale === 'zh' ? '联系销售 | 元点流商 OriginFlow' : 'Contact Sales | OriginFlow',
    description:
      locale === 'zh'
        ? '告诉我们您的需求，我们的团队将尽快与您联系。'
        : 'Tell us about your needs and our team will reach out shortly.',
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
          <SectionTitle
            title={locale === 'zh' ? '联系销售' : 'Contact Sales'}
            description={
              locale === 'zh'
                ? '告诉我们您的需求，我们的团队将尽快与您联系。'
                : 'Tell us about your needs and our team will reach out shortly.'
            }
          />
          <div className='mx-auto max-w-2xl'>
            <ContactForm locale={locale} />
          </div>
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
