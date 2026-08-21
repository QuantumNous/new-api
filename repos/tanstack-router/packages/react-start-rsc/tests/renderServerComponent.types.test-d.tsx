import { expectTypeOf, test } from 'vitest'
import type { ReactElement } from 'react'

import { renderServerComponent } from '../src/renderServerComponent.stub'
import type {
  RenderServerComponentElement,
  RenderServerComponentResult,
} from '../src/ServerComponentTypes'

test('renderServerComponent infers nested access type', () => {
  function MyServerComponent(_props: {}): any {
    throw new Error('not executed')
  }

  const element = null as unknown as RenderServerComponentElement<{
    foo: { bar: ReactElement }
  }>

  const dataPromise = renderServerComponent(element)

  type Data = Awaited<typeof dataPromise>

  // nested selection
  expectTypeOf<Data>().toHaveProperty('foo')
  expectTypeOf<Data['foo']>().toHaveProperty('bar')

  // also: directly renderable at top-level
  type MustBeRenderable = true
  expectTypeOf<MustBeRenderable>().toEqualTypeOf<true>()
})
