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
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getRegistrationDomainBlock } from './registration-risk-api'

type RegistrationRiskDetailDialogProps = {
  blockId: number | null
  onOpenChange: (open: boolean) => void
}

const affectedUserPageSize = 20

function getUserStatusLabel(
  status: number,
  t: (key: string) => string
): string {
  if (status === 1) return t('Enabled')
  if (status === 2) return t('Disabled')
  if (status === -1) return t('Deleted')
  return String(status)
}

export function RegistrationRiskDetailDialog(
  props: RegistrationRiskDetailDialogProps
) {
  const { t } = useTranslation()
  const [userPage, setUserPage] = useState(1)
  const detailQuery = useQuery({
    queryKey: ['registration-domain-risk', 'block', props.blockId, userPage],
    queryFn: () =>
      getRegistrationDomainBlock(
        props.blockId!,
        userPage,
        affectedUserPageSize
      ),
    enabled: props.blockId != null,
  })
  const detail = detailQuery.data
  const userPageCount = Math.max(
    1,
    Math.ceil((detail?.user_total ?? 0) / affectedUserPageSize)
  )

  return (
    <Dialog
      open={props.blockId != null}
      onOpenChange={(open) => {
        if (!open) setUserPage(1)
        props.onOpenChange(open)
      }}
    >
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Registration domain incident')}</DialogTitle>
          <DialogDescription>
            {detail
              ? t('Users disabled by the block for {{domain}}', {
                  domain: detail.block.domain,
                })
              : t('Loading incident details...')}
          </DialogDescription>
        </DialogHeader>
        {detailQuery.isError && (
          <p className='text-destructive text-sm'>
            {t('Failed to load incident details')}
          </p>
        )}
        {detail && (
          <div className='space-y-4'>
            <div className='grid gap-2 text-sm sm:grid-cols-3'>
              <div>
                <span className='text-muted-foreground'>{t('Domain')}</span>
                <p className='font-medium'>{detail.block.domain}</p>
              </div>
              <div>
                <span className='text-muted-foreground'>
                  {t('Registrations')}
                </span>
                <p className='font-medium'>
                  {detail.block.observed_count} / {detail.block.threshold}
                </p>
              </div>
              <div>
                <span className='text-muted-foreground'>
                  {t('Affected users')}
                </span>
                <p className='font-medium'>{detail.user_total}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead>{t('Email')}</TableHead>
                  <TableHead>{t('Current status')}</TableHead>
                  <TableHead>{t('Recovery status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username || `#${user.user_id}`}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {getUserStatusLabel(user.current_status, t)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.restored_at > 0 ? t('Restored') : t('Not restored')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {userPageCount > 1 && (
              <div className='flex items-center justify-end gap-2'>
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  title={t('Previous')}
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft />
                  <span className='sr-only'>{t('Previous')}</span>
                </Button>
                <span className='text-muted-foreground min-w-16 text-center text-xs tabular-nums'>
                  {userPage} / {userPageCount}
                </span>
                <Button
                  type='button'
                  size='icon-sm'
                  variant='outline'
                  title={t('Next')}
                  disabled={userPage >= userPageCount}
                  onClick={() =>
                    setUserPage((page) => Math.min(userPageCount, page + 1))
                  }
                >
                  <ChevronRight />
                  <span className='sr-only'>{t('Next')}</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
