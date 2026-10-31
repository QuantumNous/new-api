import { expectTypeOf, test } from 'vitest'
import { visible } from '../hydration'
import { Hydrate } from '../Hydrate'
import type {
  HydrateOptions,
  HydrateProps,
  HydrationPrefetchFunction,
  HydrationPrefetchStrategy,
  HydrationStrategy,
} from '../Hydrate'
import type { HydrationStrategy as CoreHydrationStrategy } from '@tanstack/start-client-core/hydration'
import type { ReactNode } from 'react'

type CommonHydrateProps = {
  fallback?: ReactNode
  onHydrated?: () => void
  children: ReactNode
}

type SplitHydrateProps = CommonHydrateProps & {
  when: HydrationStrategy | (() => HydrationStrategy)
  prefetch?: never
  split?: boolean
}

type PrefetchHydrateProps = CommonHydrateProps & {
  when: HydrationStrategy | (() => HydrationStrategy)
  prefetch: HydrationPrefetchStrategy
  split?: true
}

type FunctionPrefetchHydrateProps = CommonHydrateProps & {
  when: HydrationStrategy | (() => HydrationStrategy)
  prefetch: HydrationPrefetchFunction
  split?: boolean
}

test('Hydrate component accepts the public HydrateProps type', () => {
  expectTypeOf(Hydrate).toBeFunction()
  expectTypeOf(Hydrate).parameter(0).branded.toEqualTypeOf<HydrateProps>()
})

test('HydrateOptions supports reusable spread props', () => {
  const belowFoldProps = {
    when: () => visible({ rootMargin: '800px' }),
  } satisfies HydrateOptions

  expectTypeOf(belowFoldProps).toMatchTypeOf<HydrateOptions>()

  const withFunctionPrefetch = {
    when: visible(),
    split: false,
    prefetch: (ctx) => {
      expectTypeOf(ctx.element).toEqualTypeOf<Element | null>()
      expectTypeOf(ctx.signal).toEqualTypeOf<AbortSignal>()
      expectTypeOf(ctx.preload).returns.toEqualTypeOf<Promise<void>>()
      expectTypeOf(ctx.waitFor).returns.toEqualTypeOf<
        Promise<'prefetch' | 'hydrate' | 'abort'>
      >()
    },
  } satisfies HydrateOptions

  expectTypeOf(withFunctionPrefetch).toMatchTypeOf<HydrateOptions>()
})

test('Hydrate props are exact for strategy and prefetch forms', () => {
  expectTypeOf<
    Extract<HydrateProps, { prefetch?: never }>
  >().branded.toEqualTypeOf<SplitHydrateProps>()
  expectTypeOf<
    Extract<HydrateProps, { prefetch: HydrationPrefetchStrategy }>
  >().branded.toEqualTypeOf<PrefetchHydrateProps>()
  expectTypeOf<
    Extract<HydrateProps, { prefetch: HydrationPrefetchFunction }>
  >().branded.toEqualTypeOf<FunctionPrefetchHydrateProps>()
})

test('Hydrate requires a strategy', () => {
  expectTypeOf<{
    when: HydrationStrategy
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: () => HydrationStrategy
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    children: ReactNode
  }>().not.toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: () => true
    children: ReactNode
  }>().not.toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: false
    children: ReactNode
  }>().not.toMatchTypeOf<HydrateProps>()
})

test('Hydrate requires a framework-renderable strategy', () => {
  expectTypeOf<CoreHydrationStrategy>().not.toMatchTypeOf<HydrationStrategy>()
  expectTypeOf<ReturnType<typeof visible>>().toMatchTypeOf<HydrationStrategy>()

  expectTypeOf<{
    when: CoreHydrationStrategy
    children: ReactNode
  }>().not.toMatchTypeOf<HydrateProps>()
})

test('Hydrate enforces prefetch only with split boundaries', () => {
  expectTypeOf<{
    when: HydrationStrategy
    prefetch: HydrationPrefetchStrategy
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: HydrationStrategy
    prefetch: HydrationPrefetchStrategy
    split: true
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: HydrationStrategy
    prefetch: HydrationPrefetchStrategy
    split: false
    children: ReactNode
  }>().not.toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: HydrationStrategy
    prefetch: HydrationPrefetchFunction
    split: false
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()

  expectTypeOf<{
    when: HydrationStrategy
    prefetch: HydrationPrefetchFunction
    children: ReactNode
  }>().toMatchTypeOf<HydrateProps>()
})
