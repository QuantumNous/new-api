import { Link } from '@tanstack/react-router'
import { expectTypeOf, test } from 'vitest'
import { Route as ArkTypeRoute } from '../src/routes/users/arktype.index'
import type { router } from '../src/main'

test('infers correct input and output type for valibot', () => {
  expectTypeOf(Link<typeof router, string, '/users/arktype'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<boolean | ((...args: ReadonlyArray<any>) => any)>()
    .toEqualTypeOf<{ search?: string } | undefined>()

  expectTypeOf(ArkTypeRoute.useSearch()).toEqualTypeOf<{
    search: string
  }>()
})
