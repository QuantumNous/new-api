import { useQuery } from '@tanstack/react-query'
import { Footer } from '@/components/layout/components/footer'
import { PublicLayout } from '@/components/layout'

import { ModelCard } from '../components/ModelCard'
import { Section, SectionTitle } from '../components/Section'
import { getModelCatalog } from '../api'
import { defaultModelCategories } from '../data/models'
import { marketingNavLinks } from '../data/site'
import { useLocale } from '../hooks/useLocale'
import { useSeo } from '@/lib/seo'

export function Models() {
  const locale = useLocale()
  useSeo({
    title: locale === 'zh' ? '模型能力 | 元点流商 OriginFlow' : 'Models | OriginFlow',
    description:
      locale === 'zh'
        ? '展示中国与海外模型分类及能力，可用性以控制台配置为准。'
        : 'Categories and capabilities of Chinese and global models.',
  })
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-models', locale],
    queryFn: () => getModelCatalog(locale),
  })

  const categories = data && data.length ? data : defaultModelCategories[locale]

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
            title={locale === 'zh' ? '模型能力' : 'Models'}
            description={
              locale === 'zh'
                ? '展示中国与海外模型分类及能力。具体可用性与价格以控制台配置为准。'
                : 'Categories and capabilities of Chinese and global models. Availability and pricing follow your console config.'
            }
          />
          {isLoading ? (
            <p className='text-center text-[#94A3B8]'>
              {locale === 'zh' ? '加载中…' : 'Loading…'}
            </p>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {categories.map((cat) => (
                <ModelCard key={cat.category} category={cat} />
              ))}
            </div>
          )}
        </Section>
      </div>
      <Footer />
    </PublicLayout>
  )
}
