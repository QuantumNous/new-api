import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ModelTabCategory } from '../types'

interface ModelsTabsProps {
  value: ModelTabCategory
  onValueChange: (value: ModelTabCategory) => void
}

export function ModelsTabs({ value, onValueChange }: ModelsTabsProps) {
  const { t } = useTranslation()

  const handleValueChange = (newValue: string) => {
    onValueChange(newValue as ModelTabCategory)
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange} className='w-auto'>
      <TabsList className='h-8'>
        <TabsTrigger value='metadata' className='h-7 px-3'>
          {t('Metadata')}
        </TabsTrigger>
        <TabsTrigger value='deployments' className='h-7 px-3'>
          {t('Deployments')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
