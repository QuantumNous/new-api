/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import {
  buildImageGenerationRequestBody,
  isPlaygroundImageModel,
  normalizeImageCount,
  normalizeImageGenerationSettings,
  normalizeImageQuality,
  normalizeImageSize,
  PLAYGROUND_IMAGE_MODEL,
} from './image-request-schema'

describe('isPlaygroundImageModel', () => {
  it.each([
    'gpt-image-2',
    'GPT-IMAGE-2',
    'openai/gpt-image-2',
    'gpt-image-2-mini',
    'grok-imagine-image',
    'grok-imagine-image-pro',
    'grok-2-image-1212',
    'xai/grok-imagine-image',
  ])('accepts %s', (model) => {
    expect(isPlaygroundImageModel(model)).toBe(true)
  })

  it.each([
    'gpt-image-1',
    'gpt-image-1.5',
    'chatgpt-image-latest',
    'dall-e-3',
    'dall-e-2',
    'flux-pro',
    'imagen-3',
    'grok-imagine-video',
    '',
  ])('rejects %s', (model) => {
    expect(isPlaygroundImageModel(model)).toBe(false)
  })
})

describe('normalizeImageQuality', () => {
  it('keeps official GPT Image qualities', () => {
    expect(normalizeImageQuality('auto')).toBe('auto')
    expect(normalizeImageQuality('low')).toBe('low')
    expect(normalizeImageQuality('medium')).toBe('medium')
    expect(normalizeImageQuality('high')).toBe('high')
  })

  it('clamps obsolete localStorage values onto GPT Image enums', () => {
    expect(normalizeImageQuality('standard')).toBe('medium')
    expect(normalizeImageQuality('hd')).toBe('high')
    expect(normalizeImageQuality('ultra')).toBe('auto')
  })
})

describe('normalizeImageSize', () => {
  it('keeps GPT Image sizes', () => {
    expect(normalizeImageSize('1024x1024')).toBe('1024x1024')
    expect(normalizeImageSize('1536x1024')).toBe('1536x1024')
    expect(normalizeImageSize('1024x1536')).toBe('1024x1536')
    expect(normalizeImageSize('auto')).toBe('auto')
  })

  it('clamps obsolete sizes', () => {
    expect(normalizeImageSize('256x256')).toBe('1024x1024')
    expect(normalizeImageSize('1024x1792')).toBe('1024x1536')
    expect(normalizeImageSize('1792x1024')).toBe('1536x1024')
  })
})

describe('normalizeImageCount', () => {
  it('clamps to 1–4', () => {
    expect(normalizeImageCount(0)).toBe(1)
    expect(normalizeImageCount(99)).toBe(4)
    expect(normalizeImageCount(2.7)).toBe(3)
  })
})

describe('normalizeImageGenerationSettings', () => {
  it('migrates a full legacy studio blob', () => {
    expect(
      normalizeImageGenerationSettings({
        imageCount: 10,
        imageSize: '1792x1024',
        imageQuality: 'standard',
      })
    ).toEqual({
      imageCount: 4,
      imageSize: '1536x1024',
      imageQuality: 'medium',
    })
  })
})

describe('buildImageGenerationRequestBody', () => {
  it('emits GPT Image enums for gpt-image-2', () => {
    expect(
      buildImageGenerationRequestBody({
        model: PLAYGROUND_IMAGE_MODEL,
        group: 'default',
        prompt: 'a cat',
        settings: {
          imageCount: 2,
          imageSize: '1024x1536',
          imageQuality: 'high',
        },
      })
    ).toEqual({
      model: 'gpt-image-2',
      group: 'default',
      prompt: 'a cat',
      n: 2,
      size: '1024x1536',
      quality: 'high',
    })
  })

  it('uses the same GPT-format body for grok-imagine-image', () => {
    expect(
      buildImageGenerationRequestBody({
        model: 'grok-imagine-image',
        group: 'default',
        prompt: 'a fox',
        settings: {
          imageCount: 1,
          imageSize: '1024x1024',
          imageQuality: 'medium',
        },
      })
    ).toEqual({
      model: 'grok-imagine-image',
      group: 'default',
      prompt: 'a fox',
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    })
  })

  it('strips vendor prefixes on the wire model', () => {
    const body = buildImageGenerationRequestBody({
      model: 'openai/gpt-image-2',
      group: 'auto',
      prompt: 'sunset',
      settings: {
        imageCount: 1,
        imageSize: '1024x1024',
        imageQuality: 'auto',
      },
    })
    expect(body.model).toBe('gpt-image-2')
  })

  it('never emits obsolete quality tokens from legacy settings', () => {
    const body = buildImageGenerationRequestBody({
      model: 'gpt-image-2',
      group: 'auto',
      prompt: 'sunset',
      settings: {
        imageCount: 1,
        imageSize: '1024x1024',
        imageQuality: 'standard',
      },
    })
    expect(body.quality).toBe('medium')
  })

  it('rejects models outside the GPT-format allowlist', () => {
    for (const model of ['gpt-image-1', 'dall-e-3', 'flux-pro', 'imagen-3']) {
      expect(() =>
        buildImageGenerationRequestBody({
          model,
          group: 'default',
          prompt: 'a cat',
          settings: {},
        })
      ).toThrow(/GPT-format/)
    }
  })

  it('attaches all unique reference images while preserving the primary image', () => {
    const body = buildImageGenerationRequestBody({
      model: 'gpt-image-2',
      group: 'default',
      prompt: 'edit this',
      settings: { imageCount: 1, imageSize: 'auto', imageQuality: 'auto' },
      referenceImage: 'data:image/png;base64,abc',
      referenceImages: [
        'data:image/png;base64,def',
        'data:image/png;base64,abc',
      ],
    })
    expect(body.image).toBe('data:image/png;base64,abc')
    expect(body.images).toEqual([
      'data:image/png;base64,abc',
      'data:image/png;base64,def',
    ])
  })
})
