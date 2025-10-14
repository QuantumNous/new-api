import { Table, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ViewType = 'table' | 'card'

type PricingViewToggleProps = {
  view: ViewType
  onViewChange: (view: ViewType) => void
}

export function PricingViewToggle({
  view,
  onViewChange,
}: PricingViewToggleProps) {
  return (
    <div className='hidden items-center gap-1 rounded-md border p-1 md:flex'>
      <Button
        variant={view === 'table' ? 'secondary' : 'ghost'}
        size='sm'
        onClick={() => onViewChange('table')}
        className='h-7 px-2'
      >
        <Table className='size-4' />
      </Button>
      <Button
        variant={view === 'card' ? 'secondary' : 'ghost'}
        size='sm'
        onClick={() => onViewChange('card')}
        className='h-7 px-2'
      >
        <LayoutGrid className='size-4' />
      </Button>
    </div>
  )
}
