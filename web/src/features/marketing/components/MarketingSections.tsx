import { useSiteContent } from '../hooks/useSiteContent'

export function Hero() {
  const c = useSiteContent()
  return (
    <section className='relative overflow-hidden px-4 pt-20 pb-16 text-center md:pt-28'>
      <div
        className='pointer-events-none absolute inset-0 -z-10 opacity-60'
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(79,140,255,0.25), transparent 70%)',
        }}
      />
      <span className='inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-[#94A3B8]'>
        {c.hero.badge}
      </span>
      <h1 className='mx-auto mt-6 max-w-4xl text-4xl font-bold leading-tight text-[#F8FAFC] md:text-6xl'>
        {c.hero.title}
      </h1>
      <p className='mx-auto mt-6 max-w-2xl text-base text-[#94A3B8] md:text-lg'>
        {c.hero.subtitle}
      </p>
      <div className='mt-8 flex flex-wrap items-center justify-center gap-4'>
        <a
          href='/sign-up'
          className='rounded-lg bg-gradient-to-r from-[#4F8CFF] to-[#22D3EE] px-6 py-3 font-medium text-white shadow-lg shadow-[#4F8CFF]/30 transition hover:opacity-90'
        >
          {c.hero.primaryCta}
        </a>
        <a
          href='/pricing'
          className='rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-medium text-[#F8FAFC] transition hover:bg-white/10'
        >
          {c.hero.secondaryCta}
        </a>
      </div>
    </section>
  )
}

export function TrustBar() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-8'>
      <p className='text-center text-sm text-[#94A3B8]'>{c.trustbar.title}</p>
      <div className='mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3'>
        {c.trustbar.items.map((item) => (
          <span key={item} className='text-lg font-semibold text-[#F8FAFC]/70'>
            {item}
          </span>
        ))}
      </div>
    </section>
  )
}

export function ModelGateway() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-16'>
      <div className='mx-auto max-w-4xl text-center'>
        <h2 className='text-3xl font-bold text-[#F8FAFC]'>{c.gateway.title}</h2>
        <p className='mt-3 text-[#94A3B8]'>{c.gateway.subtitle}</p>
      </div>
      <div className='mx-auto mt-10 flex max-w-3xl items-center justify-center gap-6'>
        <div className='rounded-xl border border-white/10 bg-[#111827]/70 px-8 py-6 text-center'>
          <div className='text-[#22D3EE]'>{c.gateway.inboundLabel}</div>
        </div>
        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] text-white'>
          →
        </div>
        <div className='rounded-xl border border-white/10 bg-[#111827]/70 px-8 py-6 text-center'>
          <div className='text-[#4F8CFF]'>{c.gateway.outboundLabel}</div>
        </div>
      </div>
    </section>
  )
}

export function ChinaGlobalFlow() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-16'>
      <div className='mx-auto max-w-4xl text-center'>
        <h2 className='text-3xl font-bold text-[#F8FAFC]'>{c.flow.title}</h2>
        <p className='mt-3 text-[#94A3B8]'>{c.flow.desc}</p>
      </div>
      <div className='mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2'>
        <div className='rounded-xl border border-[#22D3EE]/30 bg-[#111827]/70 p-6'>
          <div className='text-xl font-semibold text-[#22D3EE]'>
            {c.flow.chinaLabel}
          </div>
        </div>
        <div className='rounded-xl border border-[#8B5CF6]/30 bg-[#111827]/70 p-6'>
          <div className='text-xl font-semibold text-[#8B5CF6]'>
            {c.flow.globalLabel}
          </div>
        </div>
      </div>
    </section>
  )
}

export function UseCases() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-16'>
      <div className='mx-auto max-w-5xl text-center'>
        <h2 className='text-3xl font-bold text-[#F8FAFC]'>{c.useCases.title}</h2>
      </div>
      <div className='mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {c.useCases.items.map((item) => (
          <div
            key={item.title}
            className='rounded-xl border border-white/10 bg-[#111827]/70 p-6'
          >
            <div className='text-lg font-semibold text-[#F8FAFC]'>
              {item.title}
            </div>
            <p className='mt-2 text-sm text-[#94A3B8]'>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Faq() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-16'>
      <div className='mx-auto max-w-3xl text-center'>
        <h2 className='text-3xl font-bold text-[#F8FAFC]'>{c.faq.title}</h2>
      </div>
      <div className='mx-auto mt-8 max-w-3xl space-y-3'>
        {c.faq.items.map((item) => (
          <details
            key={item.q}
            className='group rounded-xl border border-white/10 bg-[#111827]/70 p-5'
          >
            <summary className='cursor-pointer list-none font-medium text-[#F8FAFC]'>
              {item.q}
            </summary>
            <p className='mt-2 text-sm text-[#94A3B8]'>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function FooterCta() {
  const c = useSiteContent()
  return (
    <section className='px-4 py-20'>
      <div className='mx-auto max-w-4xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/80 to-[#0b1220]/80 p-10 text-center'>
        <h2 className='text-3xl font-bold text-[#F8FAFC]'>{c.footerCta.title}</h2>
        <p className='mt-3 text-[#94A3B8]'>{c.footerCta.subtitle}</p>
        <a
          href='/sign-up'
          className='mt-7 inline-block rounded-lg bg-gradient-to-r from-[#4F8CFF] to-[#22D3EE] px-6 py-3 font-medium text-white shadow-lg shadow-[#4F8CFF]/30 transition hover:opacity-90'
        >
          {c.footerCta.cta}
        </a>
      </div>
    </section>
  )
}
