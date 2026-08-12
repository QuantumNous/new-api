import { expectTypeOf, test } from 'vitest'
import { createClientOnlyFn, createServerOnlyFn } from '../src/envOnly'

const inputFn = () => 'output'

const genericInputFn = <T>(input: T) => input

function overloadedFn(input: string): string
function overloadedFn(input: number): number
function overloadedFn(input: any) {
  return input
}

test("createClientOnlyFn returns the function it's given", () => {
  const outputFn = createClientOnlyFn(inputFn)
  expectTypeOf(outputFn).toEqualTypeOf<typeof inputFn>()

  const genericOutputFn = createClientOnlyFn(genericInputFn)
  expectTypeOf(genericOutputFn).toEqualTypeOf<typeof genericInputFn>()

  const overloadedOutputFn = createClientOnlyFn(overloadedFn)
  expectTypeOf(overloadedOutputFn).toEqualTypeOf<typeof overloadedFn>()
})

test("createServerOnlyFn returns the function it's given", () => {
  const outputFn = createServerOnlyFn(inputFn)
  expectTypeOf(outputFn).toEqualTypeOf<typeof inputFn>()

  const genericOutputFn = createServerOnlyFn(genericInputFn)
  expectTypeOf(genericOutputFn).toEqualTypeOf<typeof genericInputFn>()

  const overloadedOutputFn = createServerOnlyFn(overloadedFn)
  expectTypeOf(overloadedOutputFn).toEqualTypeOf<typeof overloadedFn>()
})
