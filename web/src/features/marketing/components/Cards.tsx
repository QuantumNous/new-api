import type { PublicPricingDTO, PublicModelCategoryDTO } from '../hooks/usePublicData'

export function PricingCard({ plan }: { plan: PublicPricingDTO }) {
  let features: string[] = []
  try {
    features = JSON.parse(plan.features || '[]')
  } catch {
    features = []
  }
  const highlighted = plan.plan_key === 'pro'
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? 'border-[#4F8CFF]/60 bg-[#111827]/80 shadow-lg shadow-[#4F8CFF]/20'
          : 'border-white/10 bg-[#111827]/70'
      }`}
    >
      <div className='text-sm text-[#94A3B8]'>{plan.title}</div>
      <div className='mt-2 text-3xl font-bold text-[#F8FAFC]'>
        {plan.price_text}
      </div>
      <p className='mt-2 text-sm text-[#94A3B8]'>{plan.description}</p>
      <ul className='mt-5 flex-1 space-y-2 text-sm text-[#F8FAFC]/80'>
        {features.map((f) => (
          <li key={f} className='flex gap-2'>
            <span className='text-[#22D3EE]'>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href='/sign-up'
        className={`mt-6 rounded-lg px-4 py-2.5 text-center font-medium transition hover:opacity-90 ${
          highlighted
            ? 'bg-gradient-to-r from-[#4F8CFF] to-[#22D3EE] text-white'
            : 'border border-white/15 bg-white/5 text-[#F8FAFC]'
        }`}
      >
        {plan.billing_mode === 'custom' ? 'Contact Sales' : 'Get Started'}
      </a>
    </div>
  )
}

export function ModelCategoryCard({
  category,
}: {
  category: PublicModelCategoryDTO
}) {
  let models: { name: string; tags: string; note: string }[] = []
  try {
    models = JSON.parse(category.models || '[]')
  } catch {
    models = []
  }
  return (
    <div className='rounded-2xl border border-white/10 bg-[#111827]/70 p-6'>
      <div className='text-xl font-semibold text-[#F8FAFC]'>
        {category.title}
      </div>
      <p className='mt-2 text-sm text-[#94A3B8]'>{category.description}</p>
      <div className='mt-4 flex flex-wrap gap-2'>
        {models.map((m) => (
          <span
            key={m.name}
            className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#F8FAFC]/80'
            title={m.note}
          >
            {m.name}
          </span>
        ))}
      </div>
    </div>
  )
}
