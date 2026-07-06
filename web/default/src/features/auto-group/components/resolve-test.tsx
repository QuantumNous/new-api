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
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { resolveAutoGroup } from '../api'

type ResolveTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResolveTestDialog({
  open,
  onOpenChange,
}: ResolveTestDialogProps) {
  const { t } = useTranslation()
  const [jobTitle, setJobTitle] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['auto-group-resolve', jobTitle],
    queryFn: () => resolveAutoGroup(jobTitle),
    enabled: open && jobTitle.trim().length > 0,
    staleTime: 10_000,
  })

  const result = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Search className='size-4' />
            {t('Test Matcher')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Enter a job title to preview which group it maps to. This only checks the rule result and does not change any user.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder={t('Enter a job title to test...')}
          />

          <div className='bg-muted/40 min-h-12 rounded-lg border px-3 py-2 text-sm'>
            {!jobTitle.trim() ? (
              <span className='text-muted-foreground'>
                {t('Type a job title to see the matching group.')}
              </span>
            ) : isFetching ? (
              <span className='text-muted-foreground'>{t('Checking...')}</span>
            ) : result?.matched ? (
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground'>{t('Matched:')}</span>
                <StatusBadge
                  label={result.target_group}
                  variant='success'
                  copyable={false}
                />
              </div>
            ) : (
              <span className='text-muted-foreground'>
                {t('No matching rule found')}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
