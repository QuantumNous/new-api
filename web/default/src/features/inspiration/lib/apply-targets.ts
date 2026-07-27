/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { StudioModality } from '@/features/playground/types'

import type { InspirationApplyOption } from '../types'

export const AUTORUN_STORAGE_KEY = 'workbench_inspiration_autorun'

export function applyTargetsForModality(
  modality: StudioModality
): InspirationApplyOption[] {
  if (modality === 'image') {
    return [
      { value: 'image', label: 'Image node' },
      { value: 'storyboard-row', label: 'Storyboard row' },
      { value: 'note', label: 'Note' },
    ]
  }
  if (modality === 'video') {
    return [
      { value: 'video', label: 'Video node' },
      { value: 'image-to-video', label: 'Image to video' },
      { value: 'storyboard-row', label: 'Storyboard row' },
      { value: 'note', label: 'Note' },
    ]
  }
  if (modality === 'audio') {
    return [
      { value: 'audio', label: 'Audio node' },
      { value: 'note', label: 'Note' },
    ]
  }
  return [{ value: 'note', label: 'Note' }]
}

export function readAutorunPreference(): boolean {
  try {
    return window.localStorage.getItem(AUTORUN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
