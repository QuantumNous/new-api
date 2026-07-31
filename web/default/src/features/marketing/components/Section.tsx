import type { ReactNode } from 'react'

interface SectionProps {
  id?: string
  children: ReactNode
  className?: string
  dark?: boolean
}

// 区块容器：营销页使用 PublicLayout 的 showMainContainer={false}，
// 因此每个 Section 自带 container 以实现整幅背景与对齐。
export function Section({ id, children, className = '', dark }: SectionProps) {
  return (
    <section
      id={id}
      className={`py-16 md:py-24 ${dark ? 'bg-[#070A12]' : 'bg-background'} ${className}`}
    >
      <div className='container mx-auto px-4'>{children}</div>
    </section>
  )
}

export function SectionTitle({
  title,
  description,
  align = 'center',
}: {
  title: string
  description?: string
  align?: 'center' | 'left'
}) {
  return (
    <div className={`mb-12 ${align === 'center' ? 'text-center mx-auto max-w-2xl' : ''}`}>
      <h2 className='text-3xl md:text-4xl font-bold text-foreground'>{title}</h2>
      {description && (
        <p className='mt-4 text-base md:text-lg text-[#94A3B8]'>{description}</p>
      )}
    </div>
  )
}
