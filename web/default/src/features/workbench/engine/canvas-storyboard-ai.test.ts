/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { parseStoryboardShots } from './canvas-storyboard-ai'

describe('parseStoryboardShots', () => {
  it('reads shots wrapped in a markdown fence', () => {
    const shots = parseStoryboardShots(
      '```json\n{"shots":[{"plot":"opening","image_prompt":"wide shot of a harbor","video_prompt":"slow push in","duration":4}]}\n```'
    )
    expect(shots).toEqual([
      {
        plotDescription: 'opening',
        imageGenerationPrompt: 'wide shot of a harbor',
        videoMotionPrompt: 'slow push in',
        durationSeconds: 4,
      },
    ])
  })

  it('accepts a bare array with camelCase keys and prose around it', () => {
    const shots = parseStoryboardShots(
      'Sure! [{"plotDescription":"beat","imagePrompt":"a red door","videoPrompt":"tilt up"}]'
    )
    expect(shots).toHaveLength(1)
    expect(shots[0].imageGenerationPrompt).toBe('a red door')
    expect(shots[0].durationSeconds).toBe(5)
  })

  it('falls back to the prompt when only one text field is present', () => {
    const shots = parseStoryboardShots('[{"plot":"a lone runner"}]')
    expect(shots[0]).toMatchObject({
      plotDescription: 'a lone runner',
      imageGenerationPrompt: 'a lone runner',
      videoMotionPrompt: '',
    })
  })

  it('clamps the duration and drops empty shots', () => {
    const shots = parseStoryboardShots(
      '[{"plot":"","image_prompt":""},{"image_prompt":"a train","duration":120}]'
    )
    expect(shots).toHaveLength(1)
    expect(shots[0].durationSeconds).toBe(30)
  })

  it('returns nothing for unusable replies', () => {
    expect(parseStoryboardShots('I cannot help with that')).toEqual([])
    expect(parseStoryboardShots('')).toEqual([])
  })
})
