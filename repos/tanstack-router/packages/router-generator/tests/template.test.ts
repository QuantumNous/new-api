import { describe, expect, it } from 'vitest'
import { getTargetTemplate } from '../src/template'

describe('template', () => {
  it('escapes quoted route paths in React route templates', () => {
    const template = getTargetTemplate({ target: 'react' } as never)

    expect(template.route.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
    expect(template.lazyRoute.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createLazyFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
  })

  it('escapes quoted route paths in Solid route templates', () => {
    const template = getTargetTemplate({ target: 'solid' } as never)

    expect(template.route.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
    expect(template.lazyRoute.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createLazyFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
  })

  it('escapes quoted route paths in Vue route templates', () => {
    const template = getTargetTemplate({ target: 'vue' } as never)

    expect(template.route.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
    expect(template.lazyRoute.imports.tsrExportStart(`/say-"hi"`)).toBe(
      `export const Route = createLazyFileRoute(${JSON.stringify('/say-"hi"')})(`,
    )
  })
})
