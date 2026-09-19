import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { Generator, getConfig } from '../src'

describe('validateRouteParams via generator', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  afterAll(() => {
    warnSpy.mockRestore()
  })

  it('should warn for invalid param names when running the generator', async () => {
    const folderName = 'invalid-param-names'
    const dir = join(process.cwd(), 'tests', 'generator', folderName)

    const config = getConfig({
      disableLogging: false, // Enable logging to capture warnings
      routesDirectory: dir + '/routes',
      generatedRouteTree: dir + '/routeTree.gen.ts',
    })

    const generator = new Generator({ config, root: dir })
    await generator.run()

    // Should have warned about invalid params: $123 and $user-name
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid param name'),
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('123'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('user-name'))

    // Should NOT have warned about $validParam
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('validParam'),
    )
  })
})
