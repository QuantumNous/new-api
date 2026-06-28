/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { createFileRoute } from '@tanstack/react-router'
import { SavedSkills } from '@/features/marketplace/saved-skills'

export const Route = createFileRoute('/_authenticated/skills/saved/')({
  component: SavedSkills,
})
