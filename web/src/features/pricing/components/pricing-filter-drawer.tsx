import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { PricingModel, PricingVendor } from '../api'
import { PricingSidebar } from './pricing-sidebar'

type PricingFilters = {
  vendor: string
  group: string
  endpoint: string
  tag: string
  quota: 'all' | '0' | '1'
}

type PricingFilterDrawerProps = {
  filters: PricingFilters
  onFilterChange: <K extends keyof PricingFilters>(
    key: K,
    value: PricingFilters[K]
  ) => void
  onReset: () => void
  getFilteredModels: (overrides?: Partial<PricingFilters>) => PricingModel[]
  models: PricingModel[]
  vendors: PricingVendor[]
  usableGroup: Record<string, { desc: string; ratio: number }>
  groupRatio: Record<string, number>
  endpointMap: Record<string, string>
  isLoading?: boolean
  currency: 'USD' | 'CNY'
  onCurrencyChange: (value: 'USD' | 'CNY') => void
  tokenUnit: 'M' | 'K'
  onTokenUnitChange: (value: 'M' | 'K') => void
  showWithRecharge: boolean
  onShowWithRechargeChange: (value: boolean) => void
}

export function PricingFilterDrawer(props: PricingFilterDrawerProps) {
  const [open, setOpen] = useState(false)

  const handleReset = () => {
    props.onReset()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='md:hidden'
          aria-label='Open filters'
        >
          <Filter className='mr-2 size-4' />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-[300px] overflow-y-auto p-0'>
        <SheetHeader className='p-4 pb-0'>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Filter models by vendor, group, tags, and more
          </SheetDescription>
        </SheetHeader>
        <div className='p-4'>
          <PricingSidebar {...props} onReset={handleReset} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
