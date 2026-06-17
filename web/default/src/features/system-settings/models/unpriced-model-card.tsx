/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Edit } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type UnpricedModelCardProps = {
  modelName: string
  onEdit: () => void
}

export function UnpricedModelCard({
  modelName,
  onEdit,
}: UnpricedModelCardProps) {
  const { t } = useTranslation()

  return (
    <Card className='hover:border-primary/50 transition-colors'>
      <CardContent className='flex items-center justify-between gap-3 p-4'>
        <div className='min-w-0 flex-1'>
          <h4 className='truncate text-sm font-medium'>{modelName}</h4>
          <p className='text-muted-foreground text-xs'>
            {t('Price not set')}
          </p>
        </div>
        <Button
          size='sm'
          variant='outline'
          onClick={onEdit}
          className='shrink-0'
        >
          <Edit className='size-3.5' />
          <span className='sr-only sm:not-sr-only sm:ml-1.5'>
            {t('Set price')}
          </span>
        </Button>
      </CardContent>
    </Card>
  )
}
