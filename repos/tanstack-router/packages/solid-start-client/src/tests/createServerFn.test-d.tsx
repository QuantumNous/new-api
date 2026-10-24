// import { expectTypeOf, test } from 'vitest'
// import { createServerFn } from '@tanstack/start-client-core'

// test('createServerFn returns RSC', () => {
//   const fn = createServerFn().handler(() => ({
//     rscs: [
//       <div key="0">I'm an RSC</div>,
//       <div key="1">I'm an RSC</div>,
//     ] as const,
//   }))

//   expectTypeOf(fn()).toEqualTypeOf<
//     Promise<{ rscs: readonly [ReadableStream, ReadableStream] }>
//   >()
// })
