/*
Copyright (C) 2023-2026 QuantumNous
*/

import { createFileRoute } from '@tanstack/react-router'

import { Routing } from '@/features/routing'

export const Route = createFileRoute('/_authenticated/routing/')({
  component: Routing,
})
