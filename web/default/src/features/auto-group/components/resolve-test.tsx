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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { resolveAutoGroup } from '../api'

export function ResolveTest() {
  const { t } = useTranslation()
  const [jobTitle, setJobTitle] = useState('')

  // Only query when there is a non-empty job title.
  const { data, isFetching } = useQuery({
    queryKey: ['auto-group-resolve', jobTitle],
    queryFn: () => resolveAutoGroup(jobTitle),
    enabled: jobTitle.trim().length > 0,
    staleTime: 10_000,
  })

  const result = data?.data

  return (
    <Card size='sm' className='shrink-0'>
      <CardHeader>
        <CardTitle className='flex items-center gap-1.5'>
          <Search className='size-4' />
          {t('Test Matcher')}
        </CardTitle>
        <CardDescription>
          {t('Enter a job title to preview which group it maps to.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        <Input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder={t('Enter a job title to test...')}
        />
        {jobTitle.trim() && result && !isFetching && (
          <div className='flex items-center gap-2 text-sm'>
            {result.matched ? (
              <>
                <span className='text-muted-foreground'>{t('Matched:')}</span>
                <StatusBadge
                  label={result.target_group}
                  variant='success'
                  copyable={false}
                />
              </>
            ) : (
              <span className='text-muted-foreground'>
                {t('No matching rule found')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
