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

import {
  agentSubscriptionPlanSchema,
  apiResponseSchema,
  type ApiResult,
} from '@/features/agents/types'
import { getAdminPlans } from '@/features/subscriptions/api'

const planRecordsResponseSchema = apiResponseSchema(
  z.array(z.object({ plan: agentSubscriptionPlanSchema }).strict())
)

export type AgentAdminPlan = z.infer<typeof agentSubscriptionPlanSchema>

export async function getAgentAdminPlans(): Promise<
  ApiResult<AgentAdminPlan[]>
> {
  const result = planRecordsResponseSchema.parse(await getAdminPlans())
  if (!result.success) return result
  return {
    success: true,
    message: result.message,
    data: result.data.map((record) => record.plan),
  }
}
