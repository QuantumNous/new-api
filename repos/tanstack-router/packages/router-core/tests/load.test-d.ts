import { describe, expectTypeOf, test } from 'vitest'
import type { NotFoundRouteProps, RegisteredRouter, RouteIds } from '../src'

describe('NotFoundRouteProps', () => {
  test('should have correct basic property types', () => {
    expectTypeOf<NotFoundRouteProps['data']>().toEqualTypeOf<
      unknown | undefined
    >()
    expectTypeOf<NotFoundRouteProps['isNotFound']>().toEqualTypeOf<boolean>()
    expectTypeOf<NotFoundRouteProps['routeId']>().toEqualTypeOf<
      RouteIds<RegisteredRouter['routeTree']>
    >()
  })

  test('should have data as optional property', () => {
    expectTypeOf<NotFoundRouteProps>().toMatchTypeOf<{
      data?: unknown
      isNotFound: boolean
      routeId: RouteIds<RegisteredRouter['routeTree']>
    }>()
  })

  test('should have isNotFound as required property', () => {
    expectTypeOf<Pick<NotFoundRouteProps, 'isNotFound'>>().toEqualTypeOf<{
      isNotFound: boolean
    }>()
  })

  test('should have routeId as required property', () => {
    expectTypeOf<Pick<NotFoundRouteProps, 'routeId'>>().toEqualTypeOf<{
      routeId: RouteIds<RegisteredRouter['routeTree']>
    }>()
  })

  test('should be assignable with minimal required properties', () => {
    const props: NotFoundRouteProps = {
      isNotFound: true,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(props).toMatchTypeOf<NotFoundRouteProps>()
  })

  test('should be assignable with all properties', () => {
    const props: NotFoundRouteProps = {
      data: { message: 'Not found' },
      isNotFound: true,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(props).toMatchTypeOf<NotFoundRouteProps>()
  })

  test('should accept any data type', () => {
    const propsWithString: NotFoundRouteProps = {
      data: 'string data',
      isNotFound: true,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(propsWithString).toMatchTypeOf<NotFoundRouteProps>()

    const propsWithObject: NotFoundRouteProps = {
      data: { userId: 123, message: 'User not found' },
      isNotFound: true,
      routeId: '/users' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(propsWithObject).toMatchTypeOf<NotFoundRouteProps>()

    const propsWithArray: NotFoundRouteProps = {
      data: [1, 2, 3],
      isNotFound: true,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(propsWithArray).toMatchTypeOf<NotFoundRouteProps>()
  })

  test('should accept undefined data', () => {
    const props: NotFoundRouteProps = {
      data: undefined,
      isNotFound: true,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }
    expectTypeOf(props).toMatchTypeOf<NotFoundRouteProps>()
  })

  test('notFoundComponent should accept NotFoundRouteProps', () => {
    type NotFoundComponent = (props: NotFoundRouteProps) => any

    const component: NotFoundComponent = (props) => {
      expectTypeOf(props.data).toEqualTypeOf<unknown | undefined>()
      expectTypeOf(props.isNotFound).toEqualTypeOf<boolean>()
      expectTypeOf(props.routeId).toEqualTypeOf<
        RouteIds<RegisteredRouter['routeTree']>
      >()
      return null
    }

    expectTypeOf(component).toMatchTypeOf<NotFoundComponent>()
  })

  test('defaultNotFoundComponent should accept NotFoundRouteProps', () => {
    type DefaultNotFoundComponent = (props: NotFoundRouteProps) => any

    const component: DefaultNotFoundComponent = (props) => {
      expectTypeOf(props).toMatchTypeOf<NotFoundRouteProps>()
      return null
    }

    expectTypeOf(component).toMatchTypeOf<DefaultNotFoundComponent>()
  })

  test('should be spreadable as component props', () => {
    const notFoundData = {
      data: { message: 'Custom error' },
      isNotFound: true as const,
      routeId: '/' as RouteIds<RegisteredRouter['routeTree']>,
    }

    type SpreadProps = typeof notFoundData
    expectTypeOf<SpreadProps>().toMatchTypeOf<NotFoundRouteProps>()

    const component = (props: NotFoundRouteProps) => {
      expectTypeOf(props).toMatchTypeOf<NotFoundRouteProps>()
      return null
    }

    expectTypeOf(component).parameter(0).toMatchTypeOf<NotFoundRouteProps>()
  })

  test('should maintain type safety with spread', () => {
    const data: NotFoundRouteProps = {
      data: { userId: 123 },
      isNotFound: true,
      routeId: '/users' as RouteIds<RegisteredRouter['routeTree']>,
    }

    const spreadData = { ...data }
    expectTypeOf(spreadData).toMatchTypeOf<NotFoundRouteProps>()
  })
})
