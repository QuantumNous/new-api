import { describe, expect, it, vi } from 'vitest'

import { MapScene } from '@/canvas/MapScene'
import { canStartCanvasRequest } from '@/canvas/requestGate'

describe('canvas request lifecycle', () => {
  it('enforces active-request and pointer cooldown limits', () => {
    expect(
      canStartCanvasRequest({
        activeRequests: 4,
        maxActiveRequests: 4,
        origin: 'auto',
        nowMs: 1_000,
        lastPointerRequestAt: 0,
        pointerCooldownMs: 450,
      })
    ).toBe(false)
    expect(
      canStartCanvasRequest({
        activeRequests: 1,
        maxActiveRequests: 4,
        origin: 'pointer',
        nowMs: 1_200,
        lastPointerRequestAt: 1_000,
        pointerCooldownMs: 450,
      })
    ).toBe(false)
  })

  it('terminates group artifacts and clears retained arrays on dispose', () => {
    const channel = { dead: false }
    const flyline = { dead: false }
    const packet = { dead: false }
    const scene = Object.create(MapScene.prototype) as Record<
      string,
      unknown
    > & {
      dispose: () => void
    }
    Object.assign(scene, {
      disposed: false,
      edgeBoosting: false,
      running: false,
      raf: 0,
      groups: [
        {
          channels: [channel],
          flylines: [flyline],
          packets: [packet],
          processingDueAt: new Map([['model', 1]]),
        },
      ],
      users: [{}],
      channels: [channel],
      flylines: [flyline],
      packets: [packet],
      particles: [{}],
      ripples: [{}],
      completedTraces: [{}],
      latencySamples: [10],
      resetEdgeBoost: vi.fn(),
      stop: vi.fn(),
    })

    scene.dispose()

    expect(channel.dead).toBe(true)
    expect(flyline.dead).toBe(true)
    expect(packet.dead).toBe(true)
    expect(scene.groups).toEqual([])
    expect(scene.particles).toEqual([])
  })
})
