/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PartnerAuthorization } from '@/features/partner-authorization'

const searchSchema = z.object({
  request: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/partner-authorize/')({
  component: PartnerAuthorizationRoute,
  validateSearch: searchSchema,
})

function PartnerAuthorizationRoute() {
  const { request } = Route.useSearch()
  return <PartnerAuthorization request={request} />
}
