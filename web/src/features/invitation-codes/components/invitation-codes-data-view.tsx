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
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import type { InvitationCode } from '../types'
import {
  InvitationCodeActions,
  InvitationStatus,
} from './invitation-code-actions'

type InvitationCodesDataViewProps = {
  items: InvitationCode[]
  isUpdating: boolean
  onStatusChange: (invitationCode: InvitationCode) => void
  onDelete: (invitationCode: InvitationCode) => void
}

function formatExpiration(
  invitationCode: InvitationCode,
  never: string
): string {
  if (!invitationCode.expired_time) return never
  return formatTimestampToDate(invitationCode.expired_time)
}

function getUsedBy(invitationCode: InvitationCode): string {
  if (invitationCode.used_username) return invitationCode.used_username
  return invitationCode.used_user_id ? `#${invitationCode.used_user_id}` : '-'
}

export function InvitationCodesDataView(props: InvitationCodesDataViewProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className='hidden md:block'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Code')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Created at')}</TableHead>
              <TableHead>{t('Used by')}</TableHead>
              <TableHead>{t('Used at')}</TableHead>
              <TableHead>{t('Expires at')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((invitationCode) => (
              <TableRow key={invitationCode.id}>
                <TableCell className='font-mono'>
                  {invitationCode.code_prefix}...
                </TableCell>
                <TableCell>{invitationCode.name}</TableCell>
                <TableCell>
                  <InvitationStatus invitationCode={invitationCode} />
                </TableCell>
                <TableCell>
                  {formatTimestampToDate(invitationCode.created_time)}
                </TableCell>
                <TableCell>{getUsedBy(invitationCode)}</TableCell>
                <TableCell>
                  {formatTimestampToDate(invitationCode.used_time)}
                </TableCell>
                <TableCell>
                  {formatExpiration(invitationCode, t('Never'))}
                </TableCell>
                <TableCell>
                  <InvitationCodeActions
                    invitationCode={invitationCode}
                    isUpdating={props.isUpdating}
                    onStatusChange={props.onStatusChange}
                    onDelete={props.onDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='grid gap-2 p-2 md:hidden'>
        {props.items.map((invitationCode) => (
          <article
            key={invitationCode.id}
            className='grid gap-3 rounded-lg border p-3'
          >
            <div className='flex min-w-0 items-start justify-between gap-3'>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  {invitationCode.name}
                </p>
                <p className='text-muted-foreground truncate font-mono text-xs'>
                  {invitationCode.code_prefix}...
                </p>
              </div>
              <InvitationStatus invitationCode={invitationCode} />
            </div>
            <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-xs'>
              <div>
                <dt className='text-muted-foreground'>{t('Used by')}</dt>
                <dd className='truncate'>{getUsedBy(invitationCode)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('Used at')}</dt>
                <dd>{formatTimestampToDate(invitationCode.used_time)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('Created at')}</dt>
                <dd>{formatTimestampToDate(invitationCode.created_time)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('Expires at')}</dt>
                <dd>{formatExpiration(invitationCode, t('Never'))}</dd>
              </div>
            </dl>
            <InvitationCodeActions
              invitationCode={invitationCode}
              isUpdating={props.isUpdating}
              onStatusChange={props.onStatusChange}
              onDelete={props.onDelete}
            />
          </article>
        ))}
      </div>
    </>
  )
}
