import { expectTypeOf, test } from 'vitest'
import { createServerFn } from '@tanstack/start-client-core'

/*
// disabled until we really support RSC
test.skip('createServerFn returns RSC', () => {
  const fn = createServerFn().handler(() => ({
    rscs: [
      <div key="0">I'm an RSC</div>,
      <div key="1">I'm an RSC</div>,
    ] as const,
  }))

  expectTypeOf(fn()).toEqualTypeOf<
    Promise<{
      rscs: readonly [ReadableStream, ReadableStream]
    }>
  >()
})*/

test('createServerFn returns async array', () => {
  const result: Array<{ a: number }> = [{ a: 1 }]
  const serverFn = createServerFn({ method: 'GET' }).handler(async () => {
    return result
  })

  expectTypeOf<ReturnType<typeof serverFn>>().toEqualTypeOf<
    Promise<Array<{ a: number }>>
  >()
})

test('createServerFn returns sync array', () => {
  const result: Array<{ a: number }> = [{ a: 1 }]
  const serverFn = createServerFn({ method: 'GET' }).handler(() => {
    return result
  })

  expectTypeOf<ReturnType<typeof serverFn>>().toEqualTypeOf<
    Promise<Array<{ a: number }>>
  >()
})

test('createServerFn returns async union', () => {
  const result = '1' as string | number
  const serverFn = createServerFn({ method: 'GET' }).handler(async () => {
    return result
  })

  expectTypeOf<ReturnType<typeof serverFn>>().toEqualTypeOf<
    Promise<string | number>
  >()
})

test('createServerFn returns sync union', () => {
  const result = '1' as string | number
  const serverFn = createServerFn({ method: 'GET' }).handler(() => {
    return result
  })

  expectTypeOf<ReturnType<typeof serverFn>>().toEqualTypeOf<
    Promise<string | number>
  >()
})
