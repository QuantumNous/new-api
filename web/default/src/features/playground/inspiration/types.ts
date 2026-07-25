/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { StudioModality } from '../types'

export type InspirationVariableType = 'text' | 'textarea' | 'select' | 'number'
export type InspirationVariable = {
  key: string
  label: string
  type: InspirationVariableType
  required: boolean
  default_value: string | number | null
  placeholder: string
  options: string[]
  min: number | null
  max: number | null
  max_length: number | null
}
export type InspirationModelPolicy = {
  recommended: string[]
  compatible: string[]
}
export type InspirationCovers = { small: string; medium: string; large: string }
export type InspirationExample = { url: string; caption: string }
export type InspirationRecipe = {
  id: number
  slug: string
  category_slug: string
  title: string
  description: string
  modality: StudioModality
  prompt_template: string
  negative_prompt: string
  explanation: string
  tags: string[]
  variables: InspirationVariable[]
  model_policy: InspirationModelPolicy
  parameters: Record<string, unknown>
  covers: InspirationCovers
  examples: InspirationExample[]
  use_count: number
  version_id: number
  featured: boolean
}
export type InspirationCollection = {
  id: number
  name: string
  created_at: number
  updated_at: number
}
export type InspirationSave = {
  id: number
  collection_id: number
  template_id: number
  created_at: number
}
export type InspirationLibrary = {
  collections: InspirationCollection[]
  saves: InspirationSave[]
}
export type InspirationEventType = 'impression' | 'open' | 'copy' | 'apply'
