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
import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  PADDLE_ORDER_SEARCH_PARAM,
  PADDLE_TRANSACTION_SEARCH_PARAM,
} from '@/features/wallet/constants'

const topupSearchSchema = z.record(z.string(), z.unknown()).catch({})

export const Route = createFileRoute('/console/topup')({
  validateSearch: topupSearchSchema,
  beforeLoad: ({ search }) => {
    const paddleTransactionId = search[PADDLE_TRANSACTION_SEARCH_PARAM]
    const hasPaddleTransaction =
      typeof paddleTransactionId === 'string' &&
      paddleTransactionId.trim().length > 0
    const paddleOrderId = search[PADDLE_ORDER_SEARCH_PARAM]
    const hasPaddleOrder =
      typeof paddleOrderId === 'string' && paddleOrderId.trim().length > 0
    throw redirect({
      to: '/wallet',
      search: {
        ...search,
        show_history: !hasPaddleTransaction && !hasPaddleOrder,
      },
    })
  },
})
