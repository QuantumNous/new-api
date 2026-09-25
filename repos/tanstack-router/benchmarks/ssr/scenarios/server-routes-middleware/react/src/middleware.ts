import { createMiddleware } from '@tanstack/react-start'

const make = <const TKey extends string>(key: TKey, value: number) =>
  createMiddleware({ type: 'request' }).server(({ next }) =>
    next({ context: { [key]: value } as Record<TKey, number> }),
  )

export const routeMws = [
  make('r1', 1),
  make('r2', 2),
  make('r3', 3),
  make('r4', 4),
  make('r5', 5),
] as const

export const methodMws = [make('m1', 6), make('m2', 7)] as const
