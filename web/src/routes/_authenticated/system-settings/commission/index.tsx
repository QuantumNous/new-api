/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { createFileRoute } from '@tanstack/react-router'

import { CommissionAdmin } from '@/features/system-settings/commission'

export const Route = createFileRoute(
  '/_authenticated/system-settings/commission/'
)({
  component: CommissionAdmin,
})
