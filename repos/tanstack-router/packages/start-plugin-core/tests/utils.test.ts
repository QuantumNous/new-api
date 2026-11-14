import { afterEach, describe, expect, test, vi } from 'vitest'

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

async function importUtilsWithPlatform(platform: NodeJS.Platform) {
  vi.resetModules()
  Object.defineProperty(process, 'platform', {
    ...originalPlatform,
    value: platform,
  })

  return await import('../src/utils')
}

afterEach(() => {
  vi.resetModules()
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
})

describe('normalizePath', () => {
  test('normalizes POSIX path segments on POSIX platforms', async () => {
    const { normalizePath } = await importUtilsWithPlatform('linux')

    expect(normalizePath('/app//src/../routes/index.tsx')).toBe(
      '/app/routes/index.tsx',
    )
  })

  test('normalizes empty paths like path.posix.normalize', async () => {
    const { normalizePath } = await importUtilsWithPlatform('linux')

    expect(normalizePath('')).toBe('.')
  })

  test('keeps Windows separators as normal characters on POSIX platforms', async () => {
    const { normalizePath } = await importUtilsWithPlatform('linux')
    const input = String.raw`C:\app\src\..\routes\index.tsx`

    expect(normalizePath(input)).toBe(input)
  })

  test('converts Windows separators before POSIX normalization on Windows', async () => {
    const { normalizePath } = await importUtilsWithPlatform('win32')

    expect(normalizePath(String.raw`C:\app\src\..\routes\index.tsx`)).toBe(
      'C:/app/routes/index.tsx',
    )
  })
})
