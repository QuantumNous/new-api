import { describe, expectTypeOf, test } from 'vitest'
import {
  BaseRootRoute,
  BaseRoute,
  stripSearchParams,
  type ValidatorAdapter,
} from '../src'

describe('search middlewares', () => {
  test('should use search validator output for middleware context', () => {
    type SearchInput = {
      page?: string
    }

    type SearchOutput = {
      page: number
    }

    const searchValidator: ValidatorAdapter<SearchInput, SearchOutput> = {
      types: undefined as never,
      parse: () => ({ page: 1 }),
    }

    const rootRoute = new BaseRootRoute({})

    new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      validateSearch: searchValidator,
      search: {
        middlewares: [
          ({ search, next }) => {
            expectTypeOf(search).toEqualTypeOf<SearchOutput>()
            expectTypeOf(next).toBeCallableWith({ page: 2 })
            expectTypeOf(next).parameter(0).toEqualTypeOf<SearchOutput>()
            expectTypeOf(next({ page: 2 })).toEqualTypeOf<SearchOutput>()

            return search
          },
        ],
      },
    })
  })

  test('should allow stripping default-valued validator output keys', () => {
    type RootSearch = {
      root?: string
    }

    type SearchInput = {
      foo?: string
    }

    type SearchOutput = {
      foo: string
    }

    const searchValidator: ValidatorAdapter<SearchInput, SearchOutput> = {
      types: undefined as never,
      parse: () => ({ foo: 'default' }),
    }

    const rootRoute = new BaseRootRoute({
      validateSearch: (search: RootSearch): RootSearch => search,
    })

    new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      validateSearch: searchValidator,
      search: {
        middlewares: [stripSearchParams({ foo: 'default' })],
      },
    })
  })
})
