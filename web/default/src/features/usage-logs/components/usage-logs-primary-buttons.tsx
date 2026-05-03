import { useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { LogCategory } from '../types'
import { UsageLogsFilterDialog } from './dialogs/usage-logs-filter-dialog'

interface UsageLogsPrimaryButtonsProps {
  logCategory: LogCategory
}

export function UsageLogsPrimaryButtons({
  logCategory,
}: UsageLogsPrimaryButtonsProps) {
  const { t } = useTranslation()
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)

  return (
    <div className='flex gap-2'>
      <Button size='sm' onClick={() => setFilterDialogOpen(true)}>
        <Search className='h-4 w-4' />
        {t('Search')}
      </Button>

      <UsageLogsFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        logCategory={logCategory}
      />
    </div>
  )
}
