import { useAuthStore } from '@/stores/auth-store'

import { CtaButtons } from './CtaButtons'
import type { HomeContent } from '../types'

export function Hero({ content }: { content: HomeContent['hero'] }) {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const primaryTo = isAuthenticated ? '/dashboard' : '/sign-in'

  return (
    <div className='grid items-center gap-12 lg:grid-cols-2'>
      <div>
        <span className='inline-block rounded-full border border-[#4F8CFF]/40 bg-[#4F8CFF]/10 px-4 py-1 text-sm text-[#8B5CF6]'>
          {content.badge}
        </span>
        <h1 className='mt-6 text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl'>
          {content.title}
        </h1>
        <p className='mt-4 text-lg text-[#94A3B8]'>{content.subtitle}</p>
        <p className='mt-4 text-base text-[#94A3B8]'>{content.description}</p>
        <div className='mt-8'>
          <CtaButtons
            primary={content.primaryCta}
            secondary={content.secondaryCta}
            primaryTo={primaryTo}
          />
        </div>
      </div>
      <div className='rounded-2xl border border-white/10 bg-[#0B0F1A] p-6 shadow-2xl'>
        <p className='mb-3 text-sm text-[#94A3B8]'>{content.codeTitle}</p>
        <pre className='overflow-x-auto text-sm leading-relaxed text-[#22D3EE]'>
          <code>{content.code}</code>
        </pre>
      </div>
    </div>
  )
}
