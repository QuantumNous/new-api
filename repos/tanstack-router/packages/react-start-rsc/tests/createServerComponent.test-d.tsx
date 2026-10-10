import { expectTypeOf, test, vi } from 'vitest'
import type {
  CompositeComponentResult,
  ValidateCompositeComponent,
} from '../src/ServerComponentTypes'
import { CompositeComponent } from '../src/CompositeComponent'

vi.mock('@tanstack/start-server-core', () => {
  return {
    getRequest: () => undefined,
  }
})

vi.mock('@tanstack/start-storage-context', () => {
  return {
    getStartContext: () => undefined,
  }
})
import { JSX } from 'react'

test('when a server component is created with no props', () => {
  type Post = () => React.ReactNode
  type PostComponent = CompositeComponentResult<Post>

  const node = null as unknown as JSX.Element
  expectTypeOf(node).toEqualTypeOf<JSX.Element>()
})

test('when a server component is created with props but no slots', () => {
  type Post = (props: { num: number }) => React.ReactNode
  type PostComponent = CompositeComponentResult<Post>

  const node = null as unknown as JSX.Element
  expectTypeOf(node).toEqualTypeOf<JSX.Element>()
  expectTypeOf(null as unknown as typeof CompositeComponent<PostComponent>)
    .parameter(0)
    .branded.toEqualTypeOf<{ src: PostComponent; num: number }>()
})

test('when a server component is created with child slots and props', () => {
  type Post = (props: {
    children: React.ReactNode
    num: number
  }) => React.ReactNode
  type PostComponent = CompositeComponentResult<Post>

  const node = null as unknown as JSX.Element
  expectTypeOf(node).toEqualTypeOf<JSX.Element>()
  expectTypeOf(null as unknown as typeof CompositeComponent<PostComponent>)
    .parameter(0)
    .branded.toEqualTypeOf<{
      src: PostComponent
      num: number
      children: React.ReactNode
    }>()
})

test('when a server component is created with slots with no props', () => {
  type Post = (props: { render: () => React.ReactNode }) => React.ReactNode
  type PostComponent = CompositeComponentResult<Post>

  const node = null as unknown as JSX.Element
  expectTypeOf(node).toEqualTypeOf<JSX.Element>()

  expectTypeOf(null as unknown as typeof CompositeComponent<PostComponent>)
    .parameter(0)
    .branded.toEqualTypeOf<{
      src: PostComponent
      render: () => React.ReactNode
    }>()
})

test('when a server component is created with slots with serializable props', () => {
  type Post = (props: {
    render: (index: number) => React.ReactNode
  }) => React.ReactNode

  type PostComponent = CompositeComponentResult<Post>

  const node = null as unknown as JSX.Element
  expectTypeOf(node).toEqualTypeOf<JSX.Element>()

  expectTypeOf(null as unknown as typeof CompositeComponent<PostComponent>)
    .parameter(0)
    .branded.toEqualTypeOf<{
      src: PostComponent
      render: (index: number) => React.ReactNode
    }>()
})

test('when a server component is created with slots with not serializable props', () => {
  type Post = (props: {
    render: (props: { func: () => void }) => React.ReactNode
  }) => React.ReactNode

  expectTypeOf<ValidateCompositeComponent<Post>>().toEqualTypeOf<
    (props: {
      render: (props: {
        func: 'Function is not serializable'
      }) => React.ReactNode
    }) => React.ReactNode
  >()
})

test('when server component type has incorrect return type', () => {
  expectTypeOf<ValidateCompositeComponent<() => void>>().toEqualTypeOf<
    (props: unknown) => React.ReactNode
  >()
})
