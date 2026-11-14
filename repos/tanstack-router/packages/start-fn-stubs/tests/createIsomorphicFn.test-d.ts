import { expectTypeOf, test } from 'vitest'
import { createIsomorphicFn } from '../src/createIsomorphicFn'

test('createIsomorphicFn with no implementations', () => {
  const fn = createIsomorphicFn()

  expectTypeOf(fn).toHaveProperty('server')
  expectTypeOf(fn).toHaveProperty('client')
})

test('createIsomorphicFn with server implementation', () => {
  const fn = createIsomorphicFn().server(() => 'data')

  expectTypeOf(fn).toBeCallableWith()
  expectTypeOf(fn).returns.toEqualTypeOf<string | undefined>()

  expectTypeOf(fn).toHaveProperty('client')
  expectTypeOf(fn).not.toHaveProperty('server')
})

test('createIsomorphicFn with client implementation', () => {
  const fn = createIsomorphicFn().client(() => 'data')

  expectTypeOf(fn).toBeCallableWith()
  expectTypeOf(fn).returns.toEqualTypeOf<string | undefined>()

  expectTypeOf(fn).toHaveProperty('server')
  expectTypeOf(fn).not.toHaveProperty('client')
})

test('createIsomorphicFn with server and client implementation', () => {
  const fn = createIsomorphicFn()
    .server(() => 'data')
    .client(() => 'data')

  expectTypeOf(fn).toBeCallableWith()
  expectTypeOf(fn).returns.toEqualTypeOf<string>()

  expectTypeOf(fn).not.toHaveProperty('server')
  expectTypeOf(fn).not.toHaveProperty('client')
})

test('createIsomorphicFn with varying returns', () => {
  const fn = createIsomorphicFn()
    .server(() => 'data')
    .client(() => 1)
  expectTypeOf(fn).toBeCallableWith()
  expectTypeOf(fn).returns.toEqualTypeOf<string | number>()
})

test('createIsomorphicFn with arguments', () => {
  const fn = createIsomorphicFn()
    .server((a: number, b: string) => 'data')
    .client((...args) => {
      expectTypeOf(args).toEqualTypeOf<[number, string]>()
      return 1
    })
  expectTypeOf(fn).toBeCallableWith(1, 'a')
  expectTypeOf(fn).returns.toEqualTypeOf<string | number>()

  const fn2 = createIsomorphicFn()
    .client((a: number, b: string) => 'data')
    .server((...args) => {
      expectTypeOf(args).toEqualTypeOf<[number, string]>()
      return 1
    })
  expectTypeOf(fn2).toBeCallableWith(1, 'a')
  expectTypeOf(fn2).returns.toEqualTypeOf<string | number>()
})
