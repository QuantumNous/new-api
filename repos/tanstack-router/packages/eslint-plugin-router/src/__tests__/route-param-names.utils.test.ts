import { describe, expect, it } from 'vitest'
import {
  extractParamsFromPath,
  extractParamsFromSegment,
  getInvalidParams,
  isValidParamName,
} from '../rules/route-param-names/route-param-names.utils'

describe('isValidParamName', () => {
  it('should return true for valid param names', () => {
    expect(isValidParamName('userId')).toBe(true)
    expect(isValidParamName('id')).toBe(true)
    expect(isValidParamName('_id')).toBe(true)
    expect(isValidParamName('$var')).toBe(true)
    expect(isValidParamName('user123')).toBe(true)
    expect(isValidParamName('_')).toBe(true)
    expect(isValidParamName('$')).toBe(true)
    expect(isValidParamName('ABC')).toBe(true)
    expect(isValidParamName('camelCase')).toBe(true)
    expect(isValidParamName('PascalCase')).toBe(true)
    expect(isValidParamName('snake_case')).toBe(true)
    expect(isValidParamName('$$double')).toBe(true)
    expect(isValidParamName('__double')).toBe(true)
  })

  it('should return false for invalid param names', () => {
    expect(isValidParamName('123')).toBe(false)
    expect(isValidParamName('1user')).toBe(false)
    expect(isValidParamName('user-name')).toBe(false)
    expect(isValidParamName('user.name')).toBe(false)
    expect(isValidParamName('user name')).toBe(false)
    expect(isValidParamName('')).toBe(false)
    expect(isValidParamName('user@name')).toBe(false)
    expect(isValidParamName('user#name')).toBe(false)
    expect(isValidParamName('-user')).toBe(false)
  })
})

describe('extractParamsFromSegment', () => {
  it('should return empty array for segments without $', () => {
    expect(extractParamsFromSegment('')).toEqual([])
    expect(extractParamsFromSegment('users')).toEqual([])
    expect(extractParamsFromSegment('static-segment')).toEqual([])
  })

  it('should skip wildcard segments', () => {
    expect(extractParamsFromSegment('$')).toEqual([])
    expect(extractParamsFromSegment('{$}')).toEqual([])
  })

  it('should extract simple $param format', () => {
    const result = extractParamsFromSegment('$userId')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      fullParam: '$userId',
      paramName: 'userId',
      isOptional: false,
      isValid: true,
    })
  })

  it('should extract braces {$param} format', () => {
    const result = extractParamsFromSegment('{$userId}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      fullParam: '$userId',
      paramName: 'userId',
      isOptional: false,
      isValid: true,
    })
  })

  it('should extract braces with prefix/suffix', () => {
    const result = extractParamsFromSegment('prefix{$id}suffix')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      fullParam: '$id',
      paramName: 'id',
      isOptional: false,
      isValid: true,
    })
  })

  it('should extract optional {-$param} format', () => {
    const result = extractParamsFromSegment('{-$optional}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      fullParam: '-$optional',
      paramName: 'optional',
      isOptional: true,
      isValid: true,
    })
  })

  it('should extract optional with prefix/suffix', () => {
    const result = extractParamsFromSegment('pre{-$opt}post')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      fullParam: '-$opt',
      paramName: 'opt',
      isOptional: true,
      isValid: true,
    })
  })

  it('should mark invalid param names', () => {
    const result = extractParamsFromSegment('$123invalid')
    expect(result).toHaveLength(1)
    expect(result[0]?.isValid).toBe(false)
    expect(result[0]?.paramName).toBe('123invalid')
  })

  it('should mark hyphenated param names as invalid', () => {
    const result = extractParamsFromSegment('$user-name')
    expect(result).toHaveLength(1)
    expect(result[0]?.isValid).toBe(false)
    expect(result[0]?.paramName).toBe('user-name')
  })
})

describe('extractParamsFromPath', () => {
  it('should return empty array for paths without params', () => {
    expect(extractParamsFromPath('')).toEqual([])
    expect(extractParamsFromPath('/')).toEqual([])
    expect(extractParamsFromPath('/users/list')).toEqual([])
  })

  it('should extract single param from path', () => {
    const result = extractParamsFromPath('/users/$userId')
    expect(result).toHaveLength(1)
    expect(result[0]?.paramName).toBe('userId')
  })

  it('should extract multiple params from path', () => {
    const result = extractParamsFromPath('/users/$userId/posts/$postId')
    expect(result).toHaveLength(2)
    expect(result[0]?.paramName).toBe('userId')
    expect(result[1]?.paramName).toBe('postId')
  })

  it('should extract params with various formats', () => {
    const result = extractParamsFromPath(
      '/a/$simple/b/{$braces}/c/{-$optional}',
    )
    expect(result).toHaveLength(3)
    expect(result[0]?.paramName).toBe('simple')
    expect(result[0]?.isOptional).toBe(false)
    expect(result[1]?.paramName).toBe('braces')
    expect(result[1]?.isOptional).toBe(false)
    expect(result[2]?.paramName).toBe('optional')
    expect(result[2]?.isOptional).toBe(true)
  })
})

describe('getInvalidParams', () => {
  it('should return empty array for valid params', () => {
    expect(getInvalidParams('/users/$userId')).toEqual([])
    expect(getInvalidParams('/users/$_id')).toEqual([])
    expect(getInvalidParams('/users/$$var')).toEqual([])
  })

  it('should return invalid params only', () => {
    const result = getInvalidParams('/users/$123/posts/$validId')
    expect(result).toHaveLength(1)
    expect(result[0]?.paramName).toBe('123')
  })

  it('should return all invalid params', () => {
    const result = getInvalidParams('/users/$1id/posts/$post-id')
    expect(result).toHaveLength(2)
    expect(result[0]?.paramName).toBe('1id')
    expect(result[1]?.paramName).toBe('post-id')
  })
})
