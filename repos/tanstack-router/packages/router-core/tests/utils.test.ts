import { afterEach, describe, expect, it } from 'vitest'
import {
  decodePath,
  deepEqual,
  encodePathLikeUrl,
  escapeHtml,
  isPlainArray,
  replaceEqualDeep,
} from '../src/utils'

describe('replaceEqualDeep', () => {
  it('should return the same object if the input objects are equal', () => {
    const obj = { a: 1, b: 2 }
    const result = replaceEqualDeep(obj, obj)
    expect(result).toBe(obj)
  })

  it('should return a new object with replaced values if the input objects are not equal', () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { a: 1, b: 3 }
    const result = replaceEqualDeep(obj1, obj2)
    expect(result).toStrictEqual(obj2)
  })

  it('should handle arrays correctly', () => {
    const arr1 = [1, 2, 3]
    const arr2 = [1, 2, 4]
    const result = replaceEqualDeep(arr1, arr2)
    expect(result).toStrictEqual(arr2)
  })

  it('should handle nested objects correctly', () => {
    const obj1 = { a: 1, b: { c: 2 } }
    const obj2 = { a: 1, b: { c: 3 } }
    const result = replaceEqualDeep(obj1, obj2)
    expect(result).toStrictEqual(obj2)
  })

  describe('symbol properties', () => {
    it('should look at symbol properties in the object comparison', () => {
      const propertyKey = Symbol('property')
      const obj1 = { a: 1, [propertyKey]: 2 }
      const obj2 = { a: 1, [propertyKey]: 3 }
      const result = replaceEqualDeep(obj1, obj2)
      expect(result).toStrictEqual(obj2)
    })

    it('should copy over symbol properties when creating a new object', () => {
      const propertyKey = Symbol('property')
      const obj1 = { a: 1, [propertyKey]: 2 }
      const obj2 = { a: 3, [propertyKey]: 2 }
      const result = replaceEqualDeep(obj1, obj2)
      expect(result).toStrictEqual(obj2)
    })
  })

  describe('non-enumerable properties', () => {
    it('should treat objects with non-enumerable properties as non-plain (no need for property comparisons)', () => {
      const obj1: { a: number; b?: number } = { a: 1 }
      Object.defineProperty(obj1, 'b', { enumerable: false, value: 2 })
      const obj2: { a: number; b?: number } = { a: 1 }
      Object.defineProperty(obj2, 'b', { enumerable: false, value: 3 })
      const result = replaceEqualDeep(obj1, obj2)
      expect(result).toBe(obj2)
    })

    it("should treat objects with non-enumerable properties as non-plain (copying doesn't happen)", () => {
      const obj1: { a: number; b?: number } = { a: 1 }
      Object.defineProperty(obj1, 'b', { enumerable: false, value: 2 })
      const obj2: { a: number; b?: number } = { a: 3 }
      Object.defineProperty(obj2, 'b', { enumerable: false, value: 2 })
      const result = replaceEqualDeep(obj1, obj2)
      expect(result).toBe(obj2)
    })
  })

  it('should properly handle non-existent keys', () => {
    const obj1 = { a: 2, c: 123 }
    const obj2 = { a: 2, c: 123, b: undefined }
    const result = replaceEqualDeep(obj1, obj2)
    expect(result).toStrictEqual(obj2)
  })

  it('should correctly handle non-existent keys with the same number of fields', () => {
    const obj1 = { a: 2, c: 123 }
    const obj2 = { a: 2, b: undefined }
    const result = replaceEqualDeep(obj1, obj2)
    expect(result).toStrictEqual(obj2)
  })

  it('should return the previous value when the next value is an equal primitive', () => {
    expect(replaceEqualDeep(1, 1)).toBe(1)
    expect(replaceEqualDeep('1', '1')).toBe('1')
    expect(replaceEqualDeep(true, true)).toBe(true)
    expect(replaceEqualDeep(false, false)).toBe(false)
    expect(replaceEqualDeep(null, null)).toBe(null)
    expect(replaceEqualDeep(undefined, undefined)).toBe(undefined)
  })
  it('should return the next value when the previous value is a different value', () => {
    const date1 = new Date()
    const date2 = new Date()
    expect(replaceEqualDeep(1, 0)).toBe(0)
    expect(replaceEqualDeep(1, 2)).toBe(2)
    expect(replaceEqualDeep('1', '2')).toBe('2')
    expect(replaceEqualDeep(true, false)).toBe(false)
    expect(replaceEqualDeep(false, true)).toBe(true)
    expect(replaceEqualDeep(date1, date2)).toBe(date2)
  })

  it('should return the next value when the previous value is a different type', () => {
    const array = [1]
    const object = { a: 'a' }
    expect(replaceEqualDeep(0, undefined)).toBe(undefined)
    expect(replaceEqualDeep(undefined, 0)).toBe(0)
    expect(replaceEqualDeep(2, undefined)).toBe(undefined)
    expect(replaceEqualDeep(undefined, 2)).toBe(2)
    expect(replaceEqualDeep(undefined, null)).toBe(null)
    expect(replaceEqualDeep(null, undefined)).toBe(undefined)
    expect(replaceEqualDeep({}, undefined)).toBe(undefined)
    expect(replaceEqualDeep([], undefined)).toBe(undefined)
    expect(replaceEqualDeep(array, object)).toBe(object)
    expect(replaceEqualDeep(object, array)).toBe(array)
  })

  it('should return the previous value when the next value is an equal array', () => {
    const prev = [1, 2]
    const next = [1, 2]
    expect(replaceEqualDeep(prev, next)).toBe(prev)
  })

  it('should return a copy when the previous value is a different array subset', () => {
    const prev = [1, 2]
    const next = [1, 2, 3]
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
  })

  it('should return a copy when the previous value is a different array superset', () => {
    const prev = [1, 2, 3]
    const next = [1, 2]
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
  })

  it('should return the previous value when the next value is an equal empty array', () => {
    const prev: Array<any> = []
    const next: Array<any> = []
    expect(replaceEqualDeep(prev, next)).toBe(prev)
  })

  it('should return the previous value when the next value is an equal empty object', () => {
    const prev = {}
    const next = {}
    expect(replaceEqualDeep(prev, next)).toBe(prev)
  })

  it('should return the previous value when the next value is an equal object', () => {
    const prev = { a: 'a' }
    const next = { a: 'a' }
    expect(replaceEqualDeep(prev, next)).toBe(prev)
  })

  it('should replace different values in objects', () => {
    const prev = { a: { b: 'b' }, c: 'c' }
    const next = { a: { b: 'b' }, c: 'd' }
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result.a).toBe(prev.a)
    expect(result.c).toBe(next.c)
  })

  it('should replace different values in arrays', () => {
    const prev = [1, { a: 'a' }, { b: { b: 'b' } }, [1]] as const
    const next = [1, { a: 'a' }, { b: { b: 'c' } }, [1]] as const
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result[0]).toBe(prev[0])
    expect(result[1]).toBe(prev[1])
    expect(result[2]).not.toBe(next[2])
    expect(result[2].b.b).toBe(next[2].b.b)
    expect(result[3]).toBe(prev[3])
  })

  it('should replace different values in arrays when the next value is a subset', () => {
    const prev = [{ a: 'a' }, { b: 'b' }, { c: 'c' }]
    const next = [{ a: 'a' }, { b: 'b' }]
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result[0]).toBe(prev[0])
    expect(result[1]).toBe(prev[1])
    expect(result[2]).toBeUndefined()
  })

  it('should replace different values in arrays when the next value is a superset', () => {
    const prev = [{ a: 'a' }, { b: 'b' }]
    const next = [{ a: 'a' }, { b: 'b' }, { c: 'c' }]
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result[0]).toBe(prev[0])
    expect(result[1]).toBe(prev[1])
    expect(result[2]).toBe(next[2])
  })

  it('should copy objects which are not arrays or objects', () => {
    const prev = [{ a: 'a' }, { b: 'b' }, { c: 'c' }, 1]
    const next = [{ a: 'a' }, new Map(), { c: 'c' }, 2]
    const result = replaceEqualDeep(prev, next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result[0]).toBe(prev[0])
    expect(result[1]).toBe(next[1])
    expect(result[2]).toBe(prev[2])
    expect(result[3]).toBe(next[3])
  })

  it('should support equal objects which are not arrays or objects', () => {
    const map = new Map()
    const prev = [map, [1]]
    const next = [map, [1]]
    const result = replaceEqualDeep(prev, next)
    expect(result).toBe(prev)
  })

  it('should support non equal objects which are not arrays or objects', () => {
    const map1 = new Map()
    const map2 = new Map()
    const prev = [map1, [1]]
    const next = [map2, [1]]
    const result = replaceEqualDeep(prev, next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result[0]).toBe(next[0])
    expect(result[1]).toBe(prev[1])
  })

  it('should support objects which are not plain arrays', () => {
    const prev = Object.assign([1, 2], { a: { b: 'b' }, c: 'c' })
    const next = Object.assign([1, 2], { a: { b: 'b' }, c: 'c' })
    const result = replaceEqualDeep(prev, next)
    expect(result).toBe(next)
  })

  it('should replace all parent objects if some nested value changes', () => {
    const prev = {
      todo: { id: '1', meta: { createdAt: 0 }, state: { done: false } },
      otherTodo: { id: '2', meta: { createdAt: 0 }, state: { done: true } },
    }
    const next = {
      todo: { id: '1', meta: { createdAt: 0 }, state: { done: true } },
      otherTodo: { id: '2', meta: { createdAt: 0 }, state: { done: true } },
    }
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result.todo).not.toBe(prev.todo)
    expect(result.todo).not.toBe(next.todo)
    expect(result.todo.id).toBe(next.todo.id)
    expect(result.todo.meta).toBe(prev.todo.meta)
    expect(result.todo.state).not.toBe(next.todo.state)
    expect(result.todo.state.done).toBe(next.todo.state.done)
    expect(result.otherTodo).toBe(prev.otherTodo)
  })

  it('should replace all parent arrays if some nested value changes', () => {
    const prev = {
      todos: [
        { id: '1', meta: { createdAt: 0 }, state: { done: false } },
        { id: '2', meta: { createdAt: 0 }, state: { done: true } },
      ],
    }
    const next = {
      todos: [
        { id: '1', meta: { createdAt: 0 }, state: { done: true } },
        { id: '2', meta: { createdAt: 0 }, state: { done: true } },
      ],
    }
    const result = replaceEqualDeep(prev, next)
    expect(result).toEqual(next)
    expect(result).not.toBe(prev)
    expect(result).not.toBe(next)
    expect(result.todos).not.toBe(prev.todos)
    expect(result.todos).not.toBe(next.todos)
    expect(result.todos[0]).not.toBe(prev.todos[0])
    expect(result.todos[0]).not.toBe(next.todos[0])
    expect(result.todos[0]?.id).toBe(next.todos[0]?.id)
    expect(result.todos[0]?.meta).toBe(prev.todos[0]?.meta)
    expect(result.todos[0]?.state).not.toBe(next.todos[0]?.state)
    expect(result.todos[0]?.state.done).toBe(next.todos[0]?.state.done)
    expect(result.todos[1]).toBe(prev.todos[1])
  })

  it('should be able to share values that contain undefined', () => {
    const current = [
      {
        data: undefined,
        foo: true,
      },
    ]

    const next = replaceEqualDeep(current, [
      {
        data: undefined,
        foo: true,
      },
    ])

    expect(current).toBe(next)
  })

  it('should return the previous value when both values are an array of undefined', () => {
    const current = [undefined]
    const next = replaceEqualDeep(current, [undefined])

    expect(next).toBe(current)
  })

  it('should return the previous value when both values are an array that contains undefined', () => {
    const current = [{ foo: 1 }, undefined]
    const next = replaceEqualDeep(current, [{ foo: 1 }, undefined])

    expect(next).toBe(current)
  })

  it('works w/ null prototype objects', () => {
    const current = Object.create(null)
    const next = Object.create(null)

    current.foo = 'bar'
    next.foo = 'bar'
    expect(replaceEqualDeep(current, next)).toBe(current)

    next.foo = 'baz'
    expect(replaceEqualDeep(current, next)).toEqual(next)
  })
})

describe('isPlainArray', () => {
  it('should return `true` for plain arrays', () => {
    expect(isPlainArray([1, 2])).toEqual(true)
  })

  it('should return `false` for non plain arrays', () => {
    expect(isPlainArray(Object.assign([1, 2], { a: 'b' }))).toEqual(false)
  })
})

describe('deepEqual', () => {
  describe.each([false, true])('partial = %s', (partial) => {
    it('should return `true` for equal objects', () => {
      const a = { a: { b: 'b' }, c: 'c', d: [{ d: 'd ' }] }
      const b = { a: { b: 'b' }, c: 'c', d: [{ d: 'd ' }] }
      expect(deepEqual(a, b, { partial })).toEqual(true)
      expect(deepEqual(b, a, { partial })).toEqual(true)
    })

    it('should return `false` for non equal objects', () => {
      const a = { a: { b: 'b' }, c: 'c' }
      const b = { a: { b: 'c' }, c: 'c' }
      expect(deepEqual(a, b, { partial })).toEqual(false)
      expect(deepEqual(b, a, { partial })).toEqual(false)
    })

    it('should return `true` for equal objects and ignore `undefined` properties', () => {
      const a = { a: 'a', b: undefined, c: 'c' }
      const b = { a: 'a', c: 'c' }
      expect(deepEqual(a, b, { partial })).toEqual(true)
      expect(deepEqual(b, a, { partial })).toEqual(true)
    })

    it('should return `true` for equal objects and ignore `undefined` nested properties', () => {
      const a = { a: { b: 'b', x: undefined }, c: 'c' }
      const b = { a: { b: 'b' }, c: 'c', d: undefined }
      expect(deepEqual(a, b, { partial })).toEqual(true)
      expect(deepEqual(b, a, { partial })).toEqual(true)
    })

    it('should return `true` for equal arrays and ignore `undefined` object properties', () => {
      const a = { a: { b: 'b' }, c: undefined }
      const b = { a: { b: 'b' } }
      expect(deepEqual([a], [b], { partial })).toEqual(true)
      expect(deepEqual([b], [a], { partial })).toEqual(true)
    })

    it('should return `true` for equal arrays and ignore nested `undefined` object properties', () => {
      const a = { a: { b: 'b', x: undefined }, c: 'c' }
      const b = { a: { b: 'b' }, c: 'c' }
      expect(deepEqual([a], [b], { partial })).toEqual(true)
      expect(deepEqual([b], [a], { partial })).toEqual(true)
    })
  })

  describe('ignoreUndefined = false', () => {
    const ignoreUndefined = false
    describe('partial = false', () => {
      const partial = false
      it('should return `false` for objects', () => {
        const a = { a: { b: 'b', x: undefined }, c: 'c' }
        const b = { a: { b: 'b' }, c: 'c', d: undefined }
        expect(deepEqual(a, b, { partial, ignoreUndefined })).toEqual(false)
        expect(deepEqual(b, a, { partial, ignoreUndefined })).toEqual(false)
      })

      it('should return `false` for arrays', () => {
        const a = { a: { b: 'b', x: undefined }, c: 'c' }
        const b = { a: { b: 'b' }, c: 'c' }
        expect(deepEqual([a], [b], { partial, ignoreUndefined })).toEqual(false)
        expect(deepEqual([b], [a], { partial, ignoreUndefined })).toEqual(false)
      })
    })
    describe('partial = true', () => {
      const partial = true
      it('should return `true` for objects', () => {
        const a = { a: { b: 'b' }, c: 'c' }
        const b = { a: { b: 'b' }, c: 'c', d: undefined }
        expect(deepEqual(a, b, { partial, ignoreUndefined })).toEqual(true)
        expect(deepEqual(b, a, { partial, ignoreUndefined })).toEqual(true)
      })

      it('should return `true` for arrays', () => {
        const a = { a: { b: 'b', x: undefined }, c: 'c' }
        const b = { a: { b: 'b' }, c: 'c' }
        expect(deepEqual([a], [b], { partial, ignoreUndefined })).toEqual(true)
        expect(deepEqual([b], [a], { partial, ignoreUndefined })).toEqual(true)
      })
    })
  })

  describe('partial comparison', () => {
    it('correctly compares partially equal objects', () => {
      const a = { a: { b: 'b' }, c: 'c', d: [{ d: 'd ' }] }
      const b = { a: { b: 'b' }, c: 'c' }
      expect(deepEqual(a, b, { partial: true })).toEqual(true)
      expect(deepEqual(b, a, { partial: true })).toEqual(false)
    })

    it('correctly compares partially equal objects and ignores `undefined` object properties', () => {
      const a = { a: { b: 'b' }, c: 'c', d: [{ d: 'd ' }], e: undefined }
      const b = { a: { b: 'b' }, c: 'c', d: undefined }
      expect(deepEqual(a, b, { partial: true })).toEqual(true)
      expect(deepEqual(b, a, { partial: true })).toEqual(false)
    })
  })

  // This might not be what we want, but this test documents how things are now
  describe('symbol and non-enumerable properties are not handled', () => {
    it.fails(
      'should return `false` for unequal objects with symbol properties',
      () => {
        const key = Symbol('foo')
        const a = { [key]: 1 }
        const b = { [key]: 2 }
        expect(deepEqual(a, b)).toEqual(false)
      },
    )

    it.fails(
      'should return `false` for unequal objects with non-enumerable properties',
      () => {
        const a = {}
        Object.defineProperty(a, 'prop', { value: 1, enumerable: false })
        const b = {}
        Object.defineProperty(b, 'prop', { value: 2, enumerable: false })
        expect(deepEqual(a, b)).toEqual(false)
      },
    )
  })

  // We voluntarily fail in this case, because users should not do it, and ignoring it enables some performance improvements
  describe('augmented object prototype fail case (no one should do this anyway)', () => {
    it.fails(
      'should not compare objects with augmented prototype properties',
      () => {
        // @ts-expect-error -- typescript is right to complain here, don't do this!
        Object.prototype.x = 'x'
        const a = { a: 1 }
        const b = { a: 1 }
        expect(deepEqual(a, b, { ignoreUndefined: false })).toEqual(true)
      },
    )

    afterEach(() => {
      // it's probably not necessary to clean this up because vitest isolates tests
      // but just in case isolation ever gets disabled, we clean the prototype to avoid disturbing other tests
      // @ts-expect-error
      delete Object.prototype.x
    })
  })
})

describe('decodePath', () => {
  it('should decode a path segment, ignoring `%` and `\\` by default, with multiple ignored items existing', () => {
    const stringToCheck =
      'https://mozilla.org/?x=%25%D1%88%D0%B5%5C%D0%BB%D0%BB%D1%8B%2F'
    const expectedResult = 'https://mozilla.org/?x=%25ше%5Cллы%2F'

    const result = decodePath(stringToCheck).path

    expect(result).toBe(expectedResult)
  })

  it('should handle malformed percent-encodings gracefully', () => {
    const stringToCheck = 'path%ZZ%D1%88test%5C%C3%A9'
    // Malformed sequences should remain as-is, valid ones decoded
    const result = decodePath(stringToCheck).path
    expect(result).toBe(`path%ZZ%D1%88test%5Cé`)
  })

  it('should return empty string unchanged', () => {
    expect(decodePath('').path).toBe('')
  })

  it('should return strings without encoding unchanged', () => {
    const stringToCheck = 'plain-text-path'
    expect(decodePath(stringToCheck).path).toBe(stringToCheck)
  })

  it('should handle consecutive ignored characters', () => {
    const stringToCheck = 'test%25%25end'
    const expectedResult = 'test%25%25end'
    expect(decodePath(stringToCheck).path).toBe(expectedResult)
  })

  it('should handle multiple ignored items of the same type with varying case', () => {
    const stringToCheck = '/params-ps/named/foo%2Fabc/c%2Fh'
    const expectedResult = '/params-ps/named/foo%2Fabc/c%2Fh'
    expect(decodePath(stringToCheck).path).toBe(expectedResult)

    const stringToCheckWithLowerCase = '/params-ps/named/foo%2Fabc/c%5C%2f%5cAh'
    const expectedResultWithLowerCase =
      '/params-ps/named/foo%2Fabc/c%5C%2f%5cAh'
    expect(decodePath(stringToCheckWithLowerCase).path).toBe(
      expectedResultWithLowerCase,
    )
  })

  describe('open redirect prevention', () => {
    it('should keep CR (%0d) encoded to prevent open redirect', () => {
      // %0d stays encoded — no decoding, no stripping, no path mismatch
      // Output is uppercase hex per RFC 3986
      const result = decodePath('/%0d/google.com/')
      expect(result.path).toBe('/%0D/google.com/')
      expect(result.path).not.toMatch(/^\/\//)
      expect(result.handledProtocolRelativeURL).toBe(false)
    })

    it('should keep LF (%0a) encoded to prevent open redirect', () => {
      const result = decodePath('/%0a/evil.com/')
      expect(result.path).toBe('/%0A/evil.com/')
      expect(result.path).not.toMatch(/^\/\//)
      expect(result.handledProtocolRelativeURL).toBe(false)
    })

    it('should keep CRLF (%0d%0a) encoded to prevent open redirect', () => {
      const result = decodePath('/%0d%0a/evil.com/')
      expect(result.path).toBe('/%0D%0A/evil.com/')
      expect(result.path).not.toMatch(/^\/\//)
      expect(result.handledProtocolRelativeURL).toBe(false)
    })

    it('should keep multiple control characters encoded', () => {
      const result = decodePath('/%0d%0d%0d/evil.com/')
      expect(result.path).toBe('/%0D%0D%0D/evil.com/')
      expect(result.path).not.toMatch(/^\/\//)
      expect(result.handledProtocolRelativeURL).toBe(false)
    })

    it('should keep null bytes encoded', () => {
      const result = decodePath('/%00/test/')
      expect(result.path).toBe('/%00/test/')
      expect(result.handledProtocolRelativeURL).toBe(false)
    })

    it('should collapse leading double slashes to prevent protocol-relative URLs', () => {
      // Direct // input should still be collapsed as defense-in-depth
      const result = decodePath('//evil.com/path')
      const url = new URL(result.path, 'http://localhost:3000')
      expect(url.origin).toBe('http://localhost:3000')
      expect(result.handledProtocolRelativeURL).toBe(true)
    })

    it('should handle normal paths unchanged', () => {
      expect(decodePath('/users/profile/').path).toBe('/users/profile/')
      expect(decodePath('/users/profile/').handledProtocolRelativeURL).toBe(
        false,
      )
      expect(decodePath('/api/v1/data').path).toBe('/api/v1/data')
      expect(decodePath('/api/v1/data').handledProtocolRelativeURL).toBe(false)
    })

    it('should handle double slash only input', () => {
      // Direct // input should also be collapsed
      const result = decodePath('//')
      expect(result.path).toBe('/')
      expect(result.handledProtocolRelativeURL).toBe(true)
    })
  })

  describe('WHATWG path percent-encode set preserved', () => {
    it('should keep curly braces encoded', () => {
      const result = decodePath('/%7B%7Bapp_name%7D%7D/Makefile')
      expect(result.path).toBe('/%7B%7Bapp_name%7D%7D/Makefile')
    })

    it('should keep angle brackets encoded', () => {
      expect(decodePath('/%3Ctest%3E').path).toBe('/%3Ctest%3E')
    })

    it('should keep double quotes encoded', () => {
      expect(decodePath('/foo%22bar').path).toBe('/foo%22bar')
    })

    it('should keep backticks encoded', () => {
      expect(decodePath('/back%60tick').path).toBe('/back%60tick')
    })

    it('should decode space (handled by encodePathLikeUrl for outgoing URLs)', () => {
      expect(decodePath('/file%20name').path).toBe('/file name')
    })

    it('should still decode safe characters', () => {
      // Regular letters/unicode should still be decoded
      expect(decodePath('/%D1%88%D0%B5%D0%BB%D0%BB%D1%8B').path).toBe('/шеллы')
    })
  })
})

/**
 * Tests for getEnumerableOwnKeys behavior (internal function).
 * Tested indirectly through replaceEqualDeep since getEnumerableOwnKeys is not exported.
 *
 * getEnumerableOwnKeys should:
 * 1. Return array of all enumerable own keys (strings + symbols)
 * 2. Return false if any property is non-enumerable
 * 3. Handle objects with no symbols efficiently (optimization target)
 */
describe('getEnumerableOwnKeys behavior (via replaceEqualDeep)', () => {
  describe('plain objects with string keys only', () => {
    it('should handle empty objects', () => {
      const prev = {}
      const next = {}
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should handle objects with single key', () => {
      const prev = { a: 1 }
      const next = { a: 1 }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should handle objects with many keys', () => {
      const prev = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7,
        h: 8,
        i: 9,
        j: 10,
      }
      const next = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7,
        h: 8,
        i: 9,
        j: 10,
      }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should handle objects with numeric string keys', () => {
      const prev = { '0': 'a', '1': 'b', '2': 'c' }
      const next = { '0': 'a', '1': 'b', '2': 'c' }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should handle objects with special string keys', () => {
      const prev = {
        'key-with-dash': 1,
        'key.with.dot': 2,
        'key with space': 3,
      }
      const next = {
        'key-with-dash': 1,
        'key.with.dot': 2,
        'key with space': 3,
      }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should detect differences in objects with string keys', () => {
      const prev = { a: 1, b: 2, c: 3 }
      const next = { a: 1, b: 99, c: 3 }
      const result = replaceEqualDeep(prev, next)
      expect(result).not.toBe(prev)
      expect(result).toEqual(next)
    })
  })

  describe('objects with symbol keys', () => {
    it('should handle objects with single symbol key', () => {
      const sym = Symbol('test')
      const prev = { [sym]: 1 }
      const next = { [sym]: 1 }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should handle objects with multiple symbol keys', () => {
      const sym1 = Symbol('a')
      const sym2 = Symbol('b')
      const sym3 = Symbol('c')
      const prev = { [sym1]: 1, [sym2]: 2, [sym3]: 3 }
      const next = { [sym1]: 1, [sym2]: 2, [sym3]: 3 }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should detect differences in symbol values', () => {
      const sym = Symbol('test')
      const prev = { [sym]: 1 }
      const next = { [sym]: 2 }
      const result = replaceEqualDeep(prev, next)
      expect(result).not.toBe(prev)
      expect(result[sym]).toBe(2)
    })

    it('should handle global symbols', () => {
      const sym = Symbol.for('global.test.key')
      const prev = { [sym]: 'value' }
      const next = { [sym]: 'value' }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })
  })

  describe('objects with mixed string and symbol keys', () => {
    it('should handle objects with both string and symbol keys', () => {
      const sym = Symbol('test')
      const prev = { a: 1, b: 2, [sym]: 3 }
      const next = { a: 1, b: 2, [sym]: 3 }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should detect differences in string keys when symbols present', () => {
      const sym = Symbol('test')
      const prev = { a: 1, b: 2, [sym]: 3 }
      const next = { a: 1, b: 99, [sym]: 3 }
      const result = replaceEqualDeep(prev, next)
      expect(result).not.toBe(prev)
      expect(result.b).toBe(99)
      expect(result[sym]).toBe(3)
    })

    it('should detect differences in symbol keys when strings present', () => {
      const sym = Symbol('test')
      const prev = { a: 1, b: 2, [sym]: 3 }
      const next = { a: 1, b: 2, [sym]: 99 }
      const result = replaceEqualDeep(prev, next)
      expect(result).not.toBe(prev)
      expect(result.a).toBe(1)
      expect(result[sym]).toBe(99)
    })

    it('should handle complex nested objects with symbols', () => {
      const sym = Symbol('nested')
      const prev = { outer: { inner: 1, [sym]: { deep: 'value' } } }
      const next = { outer: { inner: 1, [sym]: { deep: 'value' } } }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })
  })

  describe('non-enumerable properties', () => {
    it('should treat objects with non-enumerable string property as non-plain', () => {
      const prev: Record<string, number> = { a: 1 }
      Object.defineProperty(prev, 'hidden', { value: 2, enumerable: false })
      const next: Record<string, number> = { a: 1 }
      Object.defineProperty(next, 'hidden', { value: 2, enumerable: false })

      // Non-plain objects should return next, not prev (no structural sharing)
      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(next)
    })

    it('should treat objects with non-enumerable symbol property as non-plain', () => {
      const sym = Symbol('hidden')
      const prev: Record<string | symbol, number> = { a: 1 }
      Object.defineProperty(prev, sym, { value: 2, enumerable: false })
      const next: Record<string | symbol, number> = { a: 1 }
      Object.defineProperty(next, sym, { value: 2, enumerable: false })

      // Non-plain objects should return next, not prev
      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(next)
    })

    it('should handle mix of enumerable and non-enumerable properties', () => {
      const prev: Record<string, number> = { visible: 1 }
      Object.defineProperty(prev, 'hidden', { value: 2, enumerable: false })
      const next = { visible: 1 }

      // prev is non-plain (has non-enumerable), next is plain
      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(next)
    })

    it('should handle non-enumerable property that shadows a string key', () => {
      const prev = Object.create(null)
      prev.a = 1
      Object.defineProperty(prev, 'b', { value: 2, enumerable: false })

      const next = Object.create(null)
      next.a = 1
      next.b = 2 // enumerable version

      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(next)
    })
  })

  describe('edge cases for key enumeration', () => {
    it('should handle frozen objects as non-plain (configurable is false)', () => {
      const prev = Object.freeze({ a: 1, b: 2 })
      const next = Object.freeze({ a: 1, b: 2 })

      // Frozen objects have all properties as non-configurable but still enumerable
      // They should still work with replaceEqualDeep
      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(prev)
    })

    it('should handle sealed objects', () => {
      const prev = Object.seal({ a: 1, b: 2 })
      const next = Object.seal({ a: 1, b: 2 })

      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(prev)
    })

    it('should handle objects created with Object.create(null)', () => {
      const prev = Object.create(null)
      prev.a = 1
      prev.b = 2

      const next = Object.create(null)
      next.a = 1
      next.b = 2

      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(prev)
    })

    it('should handle objects with inherited properties (only own props checked)', () => {
      const proto = { inherited: 'value' }
      const prev = Object.create(proto)
      prev.own = 1

      const next = Object.create(proto)
      next.own = 1

      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(prev)
    })

    it('should not be confused by Object.prototype properties', () => {
      // Ensure hasOwnProperty, toString, etc. don't interfere
      const prev = { hasOwnProperty: 1, toString: 2, valueOf: 3 }
      const next = { hasOwnProperty: 1, toString: 2, valueOf: 3 }
      const result = replaceEqualDeep(prev, next)
      expect(result).toBe(prev)
    })
  })

  describe('performance-critical scenarios (typical router state)', () => {
    it('should efficiently handle typical router location object', () => {
      const prev = {
        pathname: '/users/123',
        search: '?tab=settings',
        hash: '#section',
        state: { key: 'abc123' },
      }
      const next = {
        pathname: '/users/123',
        search: '?tab=settings',
        hash: '#section',
        state: { key: 'abc123' },
      }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should efficiently handle typical router match object', () => {
      const prev = {
        id: 'route-1',
        routeId: '/users/$userId',
        pathname: '/users/123',
        params: { userId: '123' },
        search: {},
        fullPath: '/users/$userId',
        loaderData: { user: { name: 'John' } },
      }
      const next = {
        id: 'route-1',
        routeId: '/users/$userId',
        pathname: '/users/123',
        params: { userId: '123' },
        search: {},
        fullPath: '/users/$userId',
        loaderData: { user: { name: 'John' } },
      }
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })

    it('should efficiently handle array of matches', () => {
      const prev = [
        { id: '1', routeId: '__root__', pathname: '/', params: {} },
        { id: '2', routeId: '/users', pathname: '/users', params: {} },
        {
          id: '3',
          routeId: '/users/$userId',
          pathname: '/users/123',
          params: { userId: '123' },
        },
      ]
      const next = [
        { id: '1', routeId: '__root__', pathname: '/', params: {} },
        { id: '2', routeId: '/users', pathname: '/users', params: {} },
        {
          id: '3',
          routeId: '/users/$userId',
          pathname: '/users/123',
          params: { userId: '123' },
        },
      ]
      expect(replaceEqualDeep(prev, next)).toBe(prev)
    })
  })
})

describe('escapeHtml', () => {
  it('should escape less-than sign', () => {
    expect(escapeHtml('<')).toBe('\\u003c')
  })

  it('should escape greater-than sign', () => {
    expect(escapeHtml('>')).toBe('\\u003e')
  })

  it('should escape ampersand', () => {
    expect(escapeHtml('&')).toBe('\\u0026')
  })

  it('should escape line separator (U+2028)', () => {
    expect(escapeHtml('\u2028')).toBe('\\u2028')
  })

  it('should escape paragraph separator (U+2029)', () => {
    expect(escapeHtml('\u2029')).toBe('\\u2029')
  })

  it('should escape multiple characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e',
    )
  })

  it('should handle script tag injection attempt in JSON', () => {
    const maliciousKey = '</script><script>alert("XSS")</script>'
    const json = JSON.stringify({ key: maliciousKey })
    const escaped = escapeHtml(json)

    // The escaped version should not contain literal < or > characters
    expect(escaped).not.toContain('<')
    expect(escaped).not.toContain('>')

    // The escaped version should still be valid JSON when evaluated
    // (the escape sequences are valid in JavaScript strings)
    expect(escaped).toContain('\\u003c')
    expect(escaped).toContain('\\u003e')
  })

  it('should return strings without special characters unchanged', () => {
    const safe = 'hello world 123'
    expect(escapeHtml(safe)).toBe(safe)
  })

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('should handle mixed content', () => {
    expect(escapeHtml('a<b>c&d\u2028e\u2029f')).toBe(
      'a\\u003cb\\u003ec\\u0026d\\u2028e\\u2029f',
    )
  })
})

describe('encodePathLikeUrl', () => {
  it('should return path unchanged if no non-ASCII characters', () => {
    expect(encodePathLikeUrl('/foo/bar/baz')).toBe('/foo/bar/baz')
  })

  it('should encode non-ASCII characters', () => {
    expect(encodePathLikeUrl('/path/caf\u00e9')).toBe('/path/caf%C3%A9')
  })

  it('should encode unicode characters in path segments', () => {
    expect(encodePathLikeUrl('/users/\u4e2d\u6587/profile')).toBe(
      '/users/%E4%B8%AD%E6%96%87/profile',
    )
  })

  it('should encode spaces but preserve other ASCII special characters', () => {
    // encodePathLikeUrl encodes whitespace and non-ASCII, but not other ASCII special chars
    expect(encodePathLikeUrl('/path/file name.pdf')).toBe(
      '/path/file%20name.pdf',
    )
    expect(encodePathLikeUrl('/path/file[1].pdf')).toBe('/path/file[1].pdf')
    expect(encodePathLikeUrl('/path#section')).toBe('/path#section')
  })

  it('should handle mixed ASCII and non-ASCII characters', () => {
    expect(encodePathLikeUrl('/path/caf\u00e9 (copy).pdf')).toBe(
      '/path/caf%C3%A9%20(copy).pdf',
    )
  })

  it('should handle emoji characters', () => {
    expect(encodePathLikeUrl('/path/\u{1F600}/file')).toBe(
      '/path/%F0%9F%98%80/file',
    )
  })
})
