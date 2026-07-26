/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { CanvasNodeType } from '../types'
import {
  canvasZipExpandedSize,
  isSafeCanvasZipPath,
  validateCanvasZipManifest,
} from './canvas-export'

describe('canvas archive paths', () => {
  it.each([
    ['media/image-1.png', true],
    ['manifest.json', true],
    ['../secret', false],
    ['media/../../secret', false],
    ['/absolute/file', false],
    ['media\\file.png', false],
    ['media//file.png', false],
  ])('validates %s', (path, expected) => {
    expect(isSafeCanvasZipPath(path)).toBe(expected)
  })
})

describe('canvas archive preflight', () => {
  it('totals trusted JSZip uncompressed metadata and rejects missing sizes', () => {
    expect(
      canvasZipExpandedSize([
        { dir: false, name: 'manifest.json', _data: { uncompressedSize: 12 } },
        { dir: false, name: 'media/a.png', _data: { uncompressedSize: 30 } },
      ])
    ).toBe(42)
    expect(canvasZipExpandedSize([{ dir: false, name: 'unknown' }])).toBeNull()
  })

  it('validates the complete document and unique kind-matched media mapping', () => {
    const manifest = {
      formatVersion: 1,
      document: {
        nodes: [
          {
            id: 'image-1',
            type: CanvasNodeType.Image,
            title: 'Image',
            position: { x: 0, y: 0 },
            width: 100,
            height: 100,
          },
        ],
        connections: [],
        viewport: { x: 0, y: 0, k: 1 },
        backgroundMode: 'dots',
        experienceMode: 'simple',
      },
      media: [
        {
          nodeId: 'image-1',
          path: 'media/image-1.png',
          name: 'image.png',
          kind: 'image',
        },
      ],
    }
    expect(validateCanvasZipManifest(manifest)).toBe(manifest)

    const invalid = structuredClone(manifest)
    invalid.document.nodes.push({
      ...invalid.document.nodes[0],
      width: Number.POSITIVE_INFINITY,
    })
    expect(() => validateCanvasZipManifest(invalid)).toThrow(
      'archive_manifest_invalid'
    )

    const duplicateMapping = structuredClone(manifest)
    duplicateMapping.media.push({ ...duplicateMapping.media[0] })
    expect(() => validateCanvasZipManifest(duplicateMapping)).toThrow(
      'archive_media_mapping_invalid'
    )
  })
})
