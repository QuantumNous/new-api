import { useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { UsageLogsFilterDialog } from './dialogs/usage-logs-filter-dialog'
import type { LogCategory } from '../types'

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
      <Button
        className='space-x-1'
        onClick={() => setFilterDialogOpen(true)}
        variant='default'
      >
        <span>{t('Search')}</span> <Search size={18} />
      </Button>

      <UsageLogsFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        logCategory={logCategory}
      />
    </div>
  )
}
