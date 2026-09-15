import { describe, expect, it } from 'vitest'
import { dehydrateSsrMatchId, hydrateSsrMatchId } from '../src/ssr/ssr-match-id'

describe('ssr match id codec', () => {
  it('removes forward slashes in dehydrated ids', () => {
    const dehydratedId = dehydrateSsrMatchId(
      '/$orgId/projects/$projectId//acme/projects/dashboard/{}',
    )

    expect(dehydratedId).not.toContain('/')
    expect(hydrateSsrMatchId(dehydratedId)).toBe(
      '/$orgId/projects/$projectId//acme/projects/dashboard/{}',
    )
  })

  it('leaves ids without slashes unchanged', () => {
    const id = 'plain-id'

    expect(dehydrateSsrMatchId(id)).toBe(id)
    expect(hydrateSsrMatchId(id)).toBe(id)
  })

  it('decodes browser-normalized replacement chars back to slashes', () => {
    expect(hydrateSsrMatchId('\uFFFDposts\uFFFD1')).toBe('/posts/1')
  })
})
