import { useStatus } from '@/hooks/use-status'
import { InfoPanel } from './ui/info-panel'

export function FAQPanel() {
  const { status } = useStatus()
  const enabled = status?.faq_enabled
  const list = enabled ? status?.faq || [] : []

  return (
    <InfoPanel
      title='FAQ'
      items={list}
      emptyMessage='No FAQ entries.'
      renderItem={(it: any, idx: number) => (
        <div key={idx} className='space-y-1'>
          <div className='text-sm font-medium'>{it.question}</div>
          <div className='text-muted-foreground text-sm'>{it.answer}</div>
        </div>
      )}
    />
  )
}
