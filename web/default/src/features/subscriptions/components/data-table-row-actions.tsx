import { type Row } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PlanRecord } from '../types'
import { useSubscriptions } from './subscriptions-provider'

interface DataTableRowActionsProps {
  row: Row<PlanRecord>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useSubscriptions()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0'>
          <MoreHorizontal className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('update')
          }}
        >
          <Pencil className='mr-2 h-4 w-4' />
          {t('Edit')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('toggle-status')
          }}
        >
          {row.original.plan.enabled ? (
            <>
              <PowerOff className='mr-2 h-4 w-4' />
              {t('Disable')}
            </>
          ) : (
            <>
              <Power className='mr-2 h-4 w-4' />
              {t('Enable')}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
