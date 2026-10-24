import { describe, expectTypeOf, test } from 'vitest'
import type { RemountDepsOptions } from '../src'

type SearchSchema = {
  testParam: string
}

type TestRemountDepsOptions = RemountDepsOptions<'/test', SearchSchema, {}, {}>

describe('RemountDepsOptions type test', () => {
  test('search field should be directly accessible', () => {
    expectTypeOf<
      TestRemountDepsOptions['search']
    >().toEqualTypeOf<SearchSchema>()
  })
})
