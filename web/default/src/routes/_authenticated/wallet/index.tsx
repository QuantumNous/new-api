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
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from '@/features/wallet'
import {
  PADDLE_ORDER_SEARCH_PARAM,
  PADDLE_TRANSACTION_SEARCH_PARAM,
} from '@/features/wallet/constants'
import { normalizeWalletCheckoutSearch } from '@/features/wallet/lib'

const walletSearchSchema = z.object({
  show_history: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true'),
  card_bound: z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform(
      (value) => value === true || value === 'true' || value === '1' || value === 1
    ),
  [PADDLE_ORDER_SEARCH_PARAM]: z.string().optional(),
  [PADDLE_TRANSACTION_SEARCH_PARAM]: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  amount_minor: z.union([z.string(), z.number()]).optional(),
  stripe_lookup_key: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/wallet/')({
  component: RouteComponent,
  validateSearch: walletSearchSchema,
})

function RouteComponent() {
  const search = Route.useSearch()
  const paddleTransactionId = search[PADDLE_TRANSACTION_SEARCH_PARAM]
  return (
    <Wallet
      initialPaddleOrderId={search[PADDLE_ORDER_SEARCH_PARAM]}
      initialPaddleTransactionId={paddleTransactionId}
      initialShowHistory={search.show_history && !paddleTransactionId}
      cardJustBound={search.card_bound}
      initialCheckoutSearch={normalizeWalletCheckoutSearch(search)}
    />
  )
}
