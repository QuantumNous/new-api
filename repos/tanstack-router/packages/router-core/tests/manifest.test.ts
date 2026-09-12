import { describe, expect, it } from 'vitest'
import { appendUniqueUserTags } from '../src/manifest'
import type { RouterManagedTag } from '../src/manifest'

describe('appendUniqueUserTags', () => {
  it('does not modify the target for an empty category', () => {
    const existing: RouterManagedTag = {
      tag: 'meta',
      attrs: {
        name: 'description',
        content: 'existing',
      },
    }
    const target = [existing]

    appendUniqueUserTags(target, [])

    expect(target).toEqual([existing])
  })

  it('appends a single tag unchanged', () => {
    const tag: RouterManagedTag = {
      tag: 'title',
      children: 'Home',
    }
    const target: Array<RouterManagedTag> = []

    appendUniqueUserTags(target, [tag])

    expect(target).toEqual([tag])
    expect(target[0]).toBe(tag)
  })

  it('dedupes equivalent tags within one appended category', () => {
    const firstTag: RouterManagedTag = {
      tag: 'link',
      attrs: {
        href: '/style.css',
        rel: 'stylesheet',
      },
    }
    const duplicateTag: RouterManagedTag = {
      tag: 'link',
      attrs: {
        href: '/style.css',
        rel: 'stylesheet',
      },
    }
    const nextTag: RouterManagedTag = {
      tag: 'link',
      attrs: {
        href: '/next.css',
        rel: 'stylesheet',
      },
    }
    const target: Array<RouterManagedTag> = []

    appendUniqueUserTags(target, [firstTag, duplicateTag, nextTag])

    expect(target).toEqual([firstTag, nextTag])
    expect(target[0]).toBe(firstTag)
  })

  it('keeps tags that differ by attributes within one category', () => {
    const target: Array<RouterManagedTag> = []

    appendUniqueUserTags(target, [
      {
        tag: 'meta',
        attrs: {
          name: 'description',
          content: 'first',
        },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'description',
          content: 'second',
        },
      },
    ])

    expect(target).toEqual([
      {
        tag: 'meta',
        attrs: {
          name: 'description',
          content: 'first',
        },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'description',
          content: 'second',
        },
      },
    ])
  })

  it('dedupes only within the appended tag category', () => {
    const tag: RouterManagedTag = {
      tag: 'link',
      attrs: {
        href: '/style.css',
        rel: 'stylesheet',
      },
    }
    const target: Array<RouterManagedTag> = []

    appendUniqueUserTags(target, [tag, tag])
    appendUniqueUserTags(target, [tag])

    expect(target).toEqual([tag, tag])
  })
})
