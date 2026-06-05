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
  isPaymentReturnScope,
  isPaymentReturnStatus,
  toBooleanSearchValue,
} from '@/features/wallet/lib'

const walletSearchSchema = z.object({
  show_history: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => toBooleanSearchValue(value)),
  pay: z
    .string()
    .optional()
    .transform((value) => (isPaymentReturnStatus(value) ? value : undefined)),
  scope: z
    .string()
    .optional()
    .transform((value) => (isPaymentReturnScope(value) ? value : undefined)),
})

export const Route = createFileRoute('/_authenticated/wallet/')({
  component: RouteComponent,
  validateSearch: walletSearchSchema,
})

function RouteComponent() {
  const { show_history, pay, scope } = Route.useSearch()
  return <Wallet initialShowHistory={show_history} paymentReturn={{ pay, scope }} />
}
