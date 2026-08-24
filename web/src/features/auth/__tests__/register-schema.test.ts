import { describe, expect, test } from 'vitest'

import { registerFormSchema } from '../constants'

describe('registerFormSchema password strength', () => {
  test('rejects a password below the minimum strength', () => {
    const result = registerFormSchema.safeParse({
      username: 'alice',
      password: 'abcdefgh',
      confirmPassword: 'abcdefgh',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['password'])
    }
  })

  test('accepts a password that meets the minimum strength', () => {
    const result = registerFormSchema.safeParse({
      username: 'alice',
      password: 'abc123XY',
      confirmPassword: 'abc123XY',
    })
    expect(result.success).toBe(true)
  })

  test('still rejects mismatching confirmation passwords', () => {
    const result = registerFormSchema.safeParse({
      username: 'alice',
      password: 'abc123XY',
      confirmPassword: 'abc123XZ',
    })
    expect(result.success).toBe(false)
  })
})
