/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { StudioModality } from '@/features/playground/types'

export type AppliedInspirationRecipe = {
  id: number
  versionId: number
  title: string
  modality: StudioModality
  model: string
  prompt: string
  negativePrompt?: string
  parameters: Record<string, unknown>
}

/** Where an applied recipe lands: canvas node kinds plus composite flows. */
export type InspirationApplyTarget =
  | 'image'
  | 'video'
  | 'audio'
  | 'image-to-video'
  | 'storyboard-row'
  | 'note'

export type InspirationApplyOption = {
  value: InspirationApplyTarget
  label: string
}

export type RecipeApplyHandler = (
  recipe: AppliedInspirationRecipe,
  options: { target: InspirationApplyTarget; autoRun: boolean }
) => void

/** Template series shown on the inspiration landing page. */
export type InspirationSeries = 'image' | 'video'
