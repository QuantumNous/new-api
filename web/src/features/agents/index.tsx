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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getAgentCustomers, type AgentCustomer } from './api'
import { CustomerTopUps } from './customer-topups'
import { useAgentSelf } from './hooks'
import { AgentInvitations } from './invitations'
import { formatTopUps } from './money'

export function AgentCenter() {
  const { t } = useTranslation()
  const self = useAgentSelf()
  const [page, setPage] = useState(1)
  const [customer, setCustomer] = useState<AgentCustomer | null>(null)
  const profile = self.data?.profile
  const query = useQuery({
    queryKey: ['agent-customers', profile?.user_id, page],
    queryFn: () => getAgentCustomers(page),
    enabled: profile?.enabled === true,
  })
  if (self.isLoading) return <p>{t('Loading')}</p>
  if (!profile?.enabled) return <p>{t('Agent access is not enabled')}</p>
  return (
    <div className='grid gap-5'>
      <h1 className='text-xl font-semibold'>{t('Agent center')}</h1>
      <div className='grid gap-4 md:grid-cols-3'>
        {[
          [t('My customers'), query.data?.total ?? '—'],
          [t('Paying customers'), query.data?.paying_customers ?? '—'],
          [
            t('Customer top-up total'),
            query.data ? formatTopUps(query.data.totals) : '—',
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className='text-2xl font-semibold'>
              {value}
            </CardContent>
          </Card>
        ))}
      </div>
      <AgentInvitations profile={profile} />
      <Card>
        <CardHeader>
          <CardTitle>{t('My customers')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground mb-3 text-xs'>
            {t(
              'Includes historical direct invitees. Only successful payments are counted; currencies are kept separate.'
            )}
          </p>
          {query.error ? (
            <p>{t('Unable to load agent data')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Customer')}</TableHead>
                  <TableHead>{t('Registered at')}</TableHead>
                  <TableHead>{t('Top-up amount')}</TableHead>
                  <TableHead>{t('Customer image price')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.customers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.display_name || item.username}
                      <span className='text-muted-foreground ml-2 text-xs'>
                        #{item.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(item.created_at * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {formatTopUps(
                        query.data?.customer_topups.filter(
                          (row) => row.user_id === item.id
                        ) ?? []
                      )}
                    </TableCell>
                    <TableCell>
                      {item.price_cents == null
                        ? t('Platform price')
                        : `¥${(item.price_cents / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setCustomer(item)}
                      >
                        {t('Top-up records')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {query.data?.customers.length === 0 && (
            <p className='text-muted-foreground py-5 text-center'>
              {t('No customers yet')}
            </p>
          )}
          <div className='mt-4 flex justify-end gap-2'>
            <Button
              variant='outline'
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              disabled={page * 20 >= (query.data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </CardContent>
      </Card>
      {customer && (
        <CustomerTopUps
          key={customer.id}
          customer={customer}
          onClose={() => setCustomer(null)}
        />
      )}
    </div>
  )
}
