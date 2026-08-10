import { PublicLayout } from '@/components/layout/components/public-layout'

import { useMarketingNavLinks, useSiteContent } from '../hooks/useSiteContent'
import { FooterCta } from '../components/MarketingSections'
import { ModelCategoryCard } from '../components/Cards'
import { usePublicModelCategories } from '../hooks/usePublicData'

export function MarketingModels() {
  const c = useSiteContent()
  const { data, isLoading, isError } = usePublicModelCategories()
  return (
    <PublicLayout navLinks={useMarketingNavLinks()} showAuthButtons showThemeSwitch>
      <section className='px-4 pt-20 pb-8 text-center'>
        <h1 className='text-4xl font-bold text-[#F8FAFC]'>{c.models.title}</h1>
        <p className='mt-3 text-[#94A3B8]'>{c.models.subtitle}</p>
      </section>
      <section className='px-4 pb-8'>
        {isLoading && (
          <p className='text-center text-[#94A3B8]'>Loading…</p>
        )}
        {isError && (
          <p className='text-center text-red-400'>Failed to load models.</p>
        )}
        {data && data.length > 0 && (
          <div className='mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {data.map((cat) => (
              <ModelCategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </section>
      <FooterCta />
    </PublicLayout>
  )
}
