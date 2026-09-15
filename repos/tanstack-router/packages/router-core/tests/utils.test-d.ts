import { describe, expectTypeOf, test } from 'vitest'

import type { PartialMergeAll } from '../src/utils'

describe('PartialMergeAll', () => {
  test('should be `undefined` if `TUnion` is `undefined`', () => {
    expectTypeOf<
      PartialMergeAll<undefined>
    >().branded.toEqualTypeOf<undefined>()
  })
  test('should be `null` if `TUnion` is `null`', () => {
    expectTypeOf<PartialMergeAll<null>>().branded.toEqualTypeOf<null>()
  })

  test('should be `undefined` if `TUnion` is `undefined | undefined`', () => {
    expectTypeOf<
      PartialMergeAll<undefined>
    >().branded.toEqualTypeOf<undefined>()
  })

  test('should be `null | undefined` if `TUnion` is `null | undefined`', () => {
    expectTypeOf<PartialMergeAll<null | undefined>>().branded.toEqualTypeOf<
      null | undefined
    >()
  })

  test('should be `undefined` if `TUnion` is `undefined | undefined`', () => {
    expectTypeOf<PartialMergeAll<undefined>>().toEqualTypeOf<undefined>()
  })

  test('should merge two objects', () => {
    expectTypeOf<
      PartialMergeAll<{ foo: string } | { bar: number }>
    >().branded.toEqualTypeOf<{ foo?: string } | { bar?: number }>()
  })

  test('should merge undefined and an object', () => {
    expectTypeOf<PartialMergeAll<undefined | { bar: number }>>().toEqualTypeOf<
      undefined | { bar?: number }
    >()
  })

  test('should merge undefined and two objects', () => {
    expectTypeOf<
      PartialMergeAll<undefined | { bar: number } | { foo: string }>
    >().toEqualTypeOf<undefined | { bar?: number; foo?: string }>()
  })

  test('should merge undefined and two objects with same prop', () => {
    expectTypeOf<
      PartialMergeAll<undefined | { bar: number } | { bar: string }>
    >().toEqualTypeOf<undefined | { bar?: number | string }>()
  })

  test('should merge object and empty object', () => {
    expectTypeOf<PartialMergeAll<{ foo: string } | {}>>().toEqualTypeOf<{
      foo?: string
    }>()
  })
})
