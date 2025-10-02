import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LogCategory } from '../types'

interface UsageLogsTabsProps {
  value: LogCategory
  onValueChange: (value: LogCategory) => void
}

export function UsageLogsTabs({ value, onValueChange }: UsageLogsTabsProps) {
  const handleValueChange = (newValue: string) => {
    onValueChange(newValue as LogCategory)
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange} className='w-auto'>
      <TabsList className='h-8'>
        <TabsTrigger value='common' className='h-7 px-3'>
          Common Logs
        </TabsTrigger>
        <TabsTrigger value='drawing' className='h-7 px-3'>
          Drawing Logs
        </TabsTrigger>
        <TabsTrigger value='task' className='h-7 px-3'>
          Task Logs
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
