/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { createFileRoute } from '@tanstack/react-router'
import { UserHome } from '@/features/user-home'

export const Route = createFileRoute('/_authenticated/home/')({
  component: UserHome,
})
