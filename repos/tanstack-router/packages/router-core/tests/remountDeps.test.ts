import { describe, expect, test } from 'vitest'
import type { RemountDepsOptions } from '../src'

describe('RemountDepsOptions unit tests', () => {
  test('search field should be directly accessible', () => {
    type SearchSchema = {
      testParam: string
    }

    const mockOptions: RemountDepsOptions<'/test', SearchSchema, {}, {}> = {
      routeId: '/test',
      search: {
        testParam: 'test-value',
      },
      params: {},
      loaderDeps: {},
    }

    expect(mockOptions.search.testParam).toBe('test-value')
  })
})
