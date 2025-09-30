import { HelpCircle } from 'lucide-react'
import { useFAQ } from '@/features/dashboard/hooks/use-status-data'
import { InfoPanel } from './ui/info-panel'

export function FAQPanel() {
  const { items: list } = useFAQ()

  return (
    <InfoPanel
      title={
        <span className='flex items-center gap-2'>
          <HelpCircle className='h-5 w-5' />
          FAQ
        </span>
      }
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
