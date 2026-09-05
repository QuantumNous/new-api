import { describe, expect, test } from 'vitest'
import {
  composeRewrites,
  executeRewriteInput,
  executeRewriteOutput,
  rewriteBasepath,
} from '../src/rewrite'
import type { LocationRewrite } from '../src'

describe('rewrite helpers', () => {
  test('basepath rewrite strips input and restores output', () => {
    const rewrite = rewriteBasepath({ basepath: '/app/' })
    const inputUrl = new URL('https://example.com/app/posts')

    expect(executeRewriteInput(rewrite, inputUrl).pathname).toBe('/posts')

    const outputUrl = new URL('https://example.com/posts')
    expect(executeRewriteOutput(rewrite, outputUrl).pathname).toBe('/app/posts')
  })

  test('basepath rewrite handles root output', () => {
    const rewrite = rewriteBasepath({ basepath: '/app' })
    const url = new URL('https://example.com/')

    expect(executeRewriteOutput(rewrite, url).pathname).toBe('/app/')
  })

  test('case-insensitive basepath input preserves original suffix casing', () => {
    const rewrite = rewriteBasepath({ basepath: '/App' })
    const url = new URL('https://example.com/app/Users')

    expect(executeRewriteInput(rewrite, url).pathname).toBe('/Users')
  })

  test('composeRewrites applies input forward and output backward', () => {
    const calls: Array<string> = []
    const first: LocationRewrite = {
      input: ({ url }) => {
        calls.push('first-in')
        url.pathname += 'a'
        return url
      },
      output: ({ url }) => {
        calls.push('first-out')
        url.pathname += 'd'
        return url
      },
    }
    const second: LocationRewrite = {
      input: ({ url }) => {
        calls.push('second-in')
        url.pathname += 'b'
        return url
      },
      output: ({ url }) => {
        calls.push('second-out')
        url.pathname += 'c'
        return url
      },
    }

    const rewrite = composeRewrites([first, second])

    expect(
      executeRewriteInput(rewrite, new URL('https://example.com/')).pathname,
    ).toBe('/ab')
    expect(
      executeRewriteOutput(rewrite, new URL('https://example.com/')).pathname,
    ).toBe('/cd')
    expect(calls).toEqual(['first-in', 'second-in', 'second-out', 'first-out'])
  })
})
