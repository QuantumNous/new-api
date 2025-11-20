import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LogCategory } from '../types'

interface UsageLogsTabsProps {
  value: LogCategory
  onValueChange: (value: LogCategory) => void
}

export function UsageLogsTabs({ value, onValueChange }: UsageLogsTabsProps) {
  const { t } = useTranslation()
  const handleValueChange = (newValue: string) => {
    onValueChange(newValue as LogCategory)
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange} className='w-auto'>
      <TabsList className='h-8'>
        <TabsTrigger value='common' className='h-7 px-3'>
          {t('Common Logs')}
        </TabsTrigger>
        <TabsTrigger value='drawing' className='h-7 px-3'>
          {t('Drawing Logs')}
        </TabsTrigger>
        <TabsTrigger value='task' className='h-7 px-3'>
          {t('Task Logs')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
