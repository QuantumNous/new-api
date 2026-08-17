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
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { formatDong } from '../lib'
import type { MezonTopupReportData } from '../types'

interface ReportTableProps {
  report: MezonTopupReportData
}

export function ReportTable(props: ReportTableProps) {
  const { t, i18n } = useTranslation()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Transaction ID')}</TableHead>
          <TableHead>{t('Mezon transaction hash')}</TableHead>
          <TableHead>{t('Mezon user')}</TableHead>
          <TableHead>{t('Email')}</TableHead>
          <TableHead className='text-right'>{t('Amount (đồng)')}</TableHead>
          <TableHead>{t('Completed at')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.report.items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className='text-muted-foreground h-24 text-center'
            >
              {t('No Mezon top-up transactions in this month')}
            </TableCell>
          </TableRow>
        ) : (
          props.report.items.map((item) => (
            <TableRow key={item.transaction_id}>
              <TableCell>{item.transaction_id}</TableCell>
              <TableCell>
                <code
                  className='block max-w-80 truncate text-xs'
                  title={item.tx_hash}
                >
                  {item.tx_hash}
                </code>
              </TableCell>
              <TableCell>
                <div>{item.user_name || '-'}</div>
                <div className='text-muted-foreground text-xs'>
                  ID {item.user_id}
                </div>
              </TableCell>
              <TableCell>{item.user_email || '-'}</TableCell>
              <TableCell className='text-right font-medium'>
                {formatDong(item.amount, i18n.language)}
              </TableCell>
              <TableCell>
                {dayjs.unix(item.complete_time).format('YYYY-MM-DD HH:mm')}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>
            {t('Total')} ({props.report.transaction_count} {t('transactions')})
          </TableCell>
          <TableCell className='text-right font-semibold'>
            {formatDong(props.report.total_amount, i18n.language)} đồng
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}
