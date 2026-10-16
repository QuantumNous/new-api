import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

// Force the client implementation to be used in tests.
vi.mock('@tanstack/start-client-core', () => {
  return {
    createIsomorphicFn: () => {
      const chain: any = {
        client(impl: any) {
          chain._client = impl
          return chain
        },
        server(_impl: any) {
          return chain._client
        },
      }
      return chain
    },
    trackPostProcessPromise: vi.fn(),
  }
})

// Mock the RSC decoder so we can control resolution.
vi.mock('@vitejs/plugin-rsc/browser', () => {
  return {
    createFromReadableStream: vi.fn(),
  }
})

vi.mock('@vitejs/plugin-rsc/ssr', () => {
  return {
    createFromReadableStream: vi.fn(),
  }
})

import { createFromReadableStream as browserDecode } from '@vitejs/plugin-rsc/browser'

import {
  createCompositeFromStream,
  createServerComponentFromStream,
} from '../src/createServerComponentFromStream'
import {
  SERVER_COMPONENT_CSS_HREFS,
  SERVER_COMPONENT_JS_PRELOADS,
} from '../src/ServerComponentTypes'

describe('ServerComponent (client)', () => {
  it('decodes a stream only once', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })

    let createdReadableStream: ReadableStream<Uint8Array> | undefined
    let resolvePromise: (value: React.ReactNode) => void

    const decodePromise = new Promise<React.ReactNode>((resolve) => {
      resolvePromise = resolve
    })

    const decodeMock = browserDecode as unknown as ReturnType<typeof vi.fn>
    decodeMock.mockImplementation((rs: ReadableStream<Uint8Array>) => {
      createdReadableStream = rs
      return decodePromise
    })

    const Component = createServerComponentFromStream(stream)

    const { CompositeComponent } = await import('../src/CompositeComponent')

    await act(async () => {
      render(
        <React.Suspense fallback={<div>loading</div>}>
          <CompositeComponent src={Component as any} />
          <CompositeComponent src={Component as any} />
        </React.Suspense>,
      )

      // Flush Suspense/use() microtasks
      await Promise.resolve()
    })

    // Should only decode once even though we render twice
    expect(decodeMock).toHaveBeenCalledTimes(1)
    expect(createdReadableStream).toBeDefined()

    // Resolve the decode to complete the test cleanly
    resolvePromise!(React.createElement('div', null, 'ok'))
  })

  it('defers decode when SSR asset deps are provided', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })

    const decodeMock = browserDecode as unknown as ReturnType<typeof vi.fn>
    decodeMock.mockClear()
    decodeMock.mockResolvedValue(React.createElement('div', null, 'ok'))

    const Component = createCompositeFromStream(stream, {
      cssHrefs: ['/assets/component.css'],
      jsPreloads: ['/assets/component.js'],
    })

    expect(decodeMock).not.toHaveBeenCalled()
    expect(Array.from(Component[SERVER_COMPONENT_CSS_HREFS]!)).toEqual([
      '/assets/component.css',
    ])
    expect(Array.from(Component[SERVER_COMPONENT_JS_PRELOADS]!)).toEqual([
      '/assets/component.js',
    ])
  })
})
