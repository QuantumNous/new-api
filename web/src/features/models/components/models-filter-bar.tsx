import { type Table } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table'
import { type Model } from '../types'
import { ModelsTabs } from './models-tabs'

interface ModelsFilterBarProps {
  table: Table<Model>
}

export function ModelsFilterBar({ table }: ModelsFilterBarProps) {
  return (
    <div className='flex items-center justify-between gap-4'>
      {/* Left side: Vendor selector + quick actions */}
      <div className='max-w-xl flex-1'>
        <ModelsTabs />
      </div>

      {/* Right side: Search + View */}
      <div className='flex items-center gap-2'>
        <div className='relative'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
          <Input
            placeholder='Filter by name or description...'
            value={(table.getState().globalFilter as string) ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-[200px] pl-8 text-sm lg:w-[280px]'
          />
        </div>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
