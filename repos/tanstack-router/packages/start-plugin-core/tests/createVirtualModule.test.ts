import { describe, expect, test } from 'vitest'
import { createVirtualModule } from '../src/vite/createVirtualModule'

describe('createVirtualModule', () => {
  test('resolves and loads the default vite virtual id', () => {
    const plugin = createVirtualModule({
      name: 'test-virtual',
      moduleId: 'virtual:test-module',
      load() {
        return 'export const ok = true'
      },
    })

    expect((plugin as any).resolveId.handler('virtual:test-module')).toBe(
      '\0virtual:test-module',
    )
    expect((plugin as any).load.handler('\0virtual:test-module')).toBe(
      'export const ok = true',
    )
  })

  test('encodes hashes in resolved vite ids', () => {
    const plugin = createVirtualModule({
      name: 'test-hash-module-id',
      moduleId: '#virtual:test-module',
      load() {
        return 'export {}'
      },
    })

    expect((plugin as any).resolveId.handler('#virtual:test-module')).toBe(
      '\0%23virtual:test-module',
    )
    expect((plugin as any).load.handler('\0%23virtual:test-module')).toBe(
      'export {}',
    )
  })
})
