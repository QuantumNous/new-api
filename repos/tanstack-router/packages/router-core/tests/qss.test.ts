import { describe, expect, it } from 'vitest'
import { decode, encode } from '../src/qss'

describe('encode function', () => {
  it('should encode an object into a query string without a prefix', () => {
    const obj = { token: 'foo', key: 'value' }
    const queryString = encode(obj)
    expect(queryString).toEqual('token=foo&key=value')
  })

  it('should handle encoding an object with empty values and trailing equal signs', () => {
    const obj = { token: '', key: 'value=' }
    const queryString = encode(obj)
    expect(queryString).toEqual('token=&key=value%3D') // token=&key=value=
  })

  it('should handle encoding an object with array values', () => {
    const obj = { token: ['foo', 'bar'], key: 'value' }
    const queryString = encode(obj)
    expect(queryString).toEqual('token=foo%2Cbar&key=value')
  })

  it('should handle encoding an object with special characters', () => {
    const obj = { token: 'foo?', key: 'value=' }
    const queryString = encode(obj)
    expect(queryString).toEqual('token=foo%3F&key=value%3D')
  })

  it('should handle encoding a top-level key with a special character', () => {
    const obj = { 'foo=bar': 1 }
    const queryString = encode(obj)
    expect(queryString).toEqual('foo%3Dbar=1')
  })
})

describe('decode function', () => {
  it('should decode a query string without a prefix', () => {
    const queryString = 'token=foo&key=value'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ token: 'foo', key: 'value' })
  })

  it('should handle missing values and trailing equal signs', () => {
    const queryString = 'token=&key=value='
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ token: '', key: 'value=' })
  })

  it('should handle decoding a query string with array values', () => {
    const queryString = 'token=foo&token=bar&key=value'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ token: ['foo', 'bar'], key: 'value' })
  })

  it('should handle decoding a query string with special characters', () => {
    const queryString = 'token=foo%3F&key=value%3D'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ token: 'foo?', key: 'value=' })
  })

  it('should handle decoding a top-level key with a special character', () => {
    const queryString = 'foo%3Dbar=1'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ 'foo=bar': 1 })
  })

  it('should handle decoding a top-level key with a special character and without a value', () => {
    const queryString = 'foo%3Dbar='
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ 'foo=bar': '' })
  })

  it('should handle decoding a value-less top-level key with a special character', () => {
    const queryString = 'foo%3Dbar'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ 'foo=bar': '' })
  })

  it('should handle decoding a query with "100%" as a value', () => {
    const queryString = 'percentage=100%&name=Sean&foo%3Dbar&key=value%3D'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({
      percentage: '100%',
      name: 'Sean',
      'foo=bar': '',
      key: 'value=',
    })
  })

  it('should handle decoding a query with plus', () => {
    const queryString = 'q=red%2Byellow+orange'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ q: 'red+yellow orange' })
  })

  it('should decode once percent characters (%) encoded twice', () => {
    const queryString = 'q=%2540'
    const decodedObj = decode(queryString)
    expect(decodedObj).toEqual({ q: '%40' })
  })
})
