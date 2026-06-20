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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface PlategaOrderRow {
  id: number
  trade_no: string
  user_id: number
  rub_amount: number
  usd_quota_amount: number
  platega_transaction_id: string
  platega_status: string
  payment_method: string
  create_time: number
  update_time: number
}

export function PlategaOrdersAdminPanel() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<PlategaOrderRow[]>([])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/user/platega/orders?page_size=20&p=1')
      const data = res.data?.data
      if (res.data?.success && data?.items) {
        setOrders(data.items)
      }
    } catch {
      toast.error(t('Failed to load orders'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const queryStatus = async (tradeNo: string) => {
    try {
      const res = await api.post('/api/user/platega/query-status', { trade_no: tradeNo })
      if (res.data?.success) {
        toast.success(JSON.stringify(res.data.data))
      } else {
        toast.error(res.data?.message || t('Query failed'))
      }
    } catch {
      toast.error(t('Query failed'))
    }
  }

  const retryCallback = async (tradeNo: string) => {
    try {
      const res = await api.post('/api/user/platega/retry-callback', { trade_no: tradeNo })
      if (res.data?.success) {
        toast.success(t('Processed'))
        void loadOrders()
      } else {
        toast.error(res.data?.message || t('Retry failed'))
      }
    } catch {
      toast.error(t('Retry failed'))
    }
  }

  return (
    <div className='mt-6 space-y-3'>
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-semibold'>{t('Platega orders')}</h4>
        <Button type='button' variant='outline' size='sm' onClick={() => void loadOrders()} disabled={loading}>
          {t('Refresh')}
        </Button>
      </div>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full min-w-[720px] text-left text-xs'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-2 py-2'>{t('Order')}</th>
              <th className='px-2 py-2'>{t('User')}</th>
              <th className='px-2 py-2'>RUB</th>
              <th className='px-2 py-2'>{t('Status')}</th>
              <th className='px-2 py-2'>Tx ID</th>
              <th className='px-2 py-2'>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className='border-t'>
                <td className='px-2 py-2 font-mono'>{order.trade_no}</td>
                <td className='px-2 py-2'>{order.user_id}</td>
                <td className='px-2 py-2'>{order.rub_amount.toFixed(2)}</td>
                <td className='px-2 py-2'>{order.platega_status}</td>
                <td className='max-w-[180px] truncate px-2 py-2 font-mono' title={order.platega_transaction_id}>
                  {order.platega_transaction_id}
                </td>
                <td className='px-2 py-2'>
                  <div className='flex gap-1'>
                    <Button type='button' variant='ghost' size='sm' onClick={() => void queryStatus(order.trade_no)}>
                      {t('Query')}
                    </Button>
                    <Button type='button' variant='ghost' size='sm' onClick={() => void retryCallback(order.trade_no)}>
                      {t('Retry')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className='text-muted-foreground px-2 py-4 text-center'>
                  {loading ? t('Loading...') : t('No orders yet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
