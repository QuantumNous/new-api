import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UsageLogsFilterDialog } from './usage-logs-filter-dialog'

export function UsageLogsPrimaryButtons() {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)

  return (
    <div className='flex gap-2'>
      <Button
        className='space-x-1'
        onClick={() => setFilterDialogOpen(true)}
        variant='default'
      >
        <span>Search</span> <Search size={18} />
      </Button>

      <UsageLogsFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
      />
    </div>
  )
}
