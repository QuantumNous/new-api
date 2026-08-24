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
import { Eye, ShieldCheck, Unlock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RegistrationDomainBlock } from './registration-risk-api'

type RegistrationRiskIncidentTableProps = {
  incidents: RegistrationDomainBlock[]
  onInspect: (block: RegistrationDomainBlock) => void
  onRecover: (block: RegistrationDomainBlock) => void
  onReleaseOnly: (block: RegistrationDomainBlock) => void
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

export function RegistrationRiskIncidentTable(
  props: RegistrationRiskIncidentTableProps
) {
  const { t } = useTranslation()

  if (props.incidents.length === 0) {
    return (
      <div className='text-muted-foreground flex min-h-28 items-center justify-center border-y text-sm'>
        {t('No registration domain incidents')}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Domain')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Registrations')}</TableHead>
          <TableHead>{t('Affected users')}</TableHead>
          <TableHead>{t('Blocked at')}</TableHead>
          <TableHead className='text-right'>{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.incidents.map((incident) => {
          const isReleased = incident.released_at > 0
          return (
            <TableRow key={incident.id}>
              <TableCell className='font-medium'>{incident.domain}</TableCell>
              <TableCell>
                <Badge variant={isReleased ? 'secondary' : 'destructive'}>
                  {isReleased ? t('Released') : t('Blocked')}
                </Badge>
              </TableCell>
              <TableCell>
                {incident.observed_count} / {incident.threshold}
              </TableCell>
              <TableCell>{incident.affected_user_count}</TableCell>
              <TableCell>{formatTimestamp(incident.blocked_at)}</TableCell>
              <TableCell>
                <div className='flex min-w-max justify-end gap-1'>
                  <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    title={t('View incident details')}
                    onClick={() => props.onInspect(incident)}
                  >
                    <Eye />
                    <span className='sr-only'>
                      {t('View incident details')}
                    </span>
                  </Button>
                  {!isReleased && (
                    <>
                      <Button
                        type='button'
                        size='sm'
                        onClick={() => props.onRecover(incident)}
                      >
                        <ShieldCheck data-icon='inline-start' />
                        {t('Restore and trust')}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => props.onReleaseOnly(incident)}
                      >
                        <Unlock data-icon='inline-start' />
                        {t('Unblock only')}
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
