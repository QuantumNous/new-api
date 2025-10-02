import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UsageLogsFilterDialog } from './dialogs/usage-logs-filter-dialog'
import { useUsageLogsContext } from './usage-logs-provider'

export function UsageLogsPrimaryButtons() {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const { logCategory } = useUsageLogsContext()

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
        logCategory={logCategory}
      />
    </div>
  )
}
