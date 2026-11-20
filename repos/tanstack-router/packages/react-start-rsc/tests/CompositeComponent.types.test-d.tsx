import { expectTypeOf, test } from 'vitest'

import type { ComponentProps } from 'react'
import { CompositeComponent } from '../src/CompositeComponent'
import type { CompositeComponentResult } from '../src/ServerComponentTypes'

test('CompositeComponent infers slot props from src', () => {
  type Post = (props: {
    children?: React.ReactNode
    header: (title: string) => React.ReactNode
    footer: () => React.ReactNode
  }) => React.ReactNode

  const src = null as unknown as CompositeComponentResult<Post>

  expectTypeOf(CompositeComponent).toBeFunction()

  type Props = ComponentProps<typeof CompositeComponent<typeof src>>

  // Type-level: ensure inferred props include slots
  type Expected = {
    src: typeof src
    children?: React.ReactNode
    header: (title: string) => React.ReactNode
    footer: () => React.ReactNode
  }

  expectTypeOf<Props>().branded.toEqualTypeOf<Expected>()
})
