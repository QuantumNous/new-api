import { describe, expect, test } from 'vitest'

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_STRENGTH_SCORE,
  passwordStrength,
} from '../password-strength'

describe('passwordStrength', () => {
  test('flags a too-short password as score 0', () => {
    const result = passwordStrength('abc12X')
    expect(result.score).toBe(0)
    expect(result.labelKey).toBe('Password is too short')
  })

  test('flags a too-long password as score 0', () => {
    const result = passwordStrength('a'.repeat(PASSWORD_MAX_LENGTH + 1))
    expect(result.score).toBe(0)
  })

  test('labels a valid length with too few classes as Weak', () => {
    const result = passwordStrength('abcdefgh')
    expect(result.score).toBe(1)
    expect(result.labelKey).toBe('Weak password')
  })

  test('scores the minimum allowed strength as Fair', () => {
    const result = passwordStrength('abc123XY')
    expect(result.score).toBe(PASSWORD_MIN_STRENGTH_SCORE)
    expect(result.labelKey).toBe('Fair password')
  })

  test('scores a long password with three classes as Good', () => {
    const result = passwordStrength('abcdeFGh1234')
    expect(result.score).toBe(3)
    expect(result.labelKey).toBe('Good password')
  })

  test('scores four classes with length 14 or more as Strong', () => {
    const result = passwordStrength('Abcdef1234!@#$')
    expect(result.score).toBe(4)
    expect(result.labelKey).toBe('Strong password')
  })

  test('scores sixteen characters with three classes as Strong', () => {
    const result = passwordStrength('abcdeFGh1234mnop')
    expect(result.score).toBe(4)
  })

  test('keeps a long lowercase password below the minimum strength', () => {
    const result = passwordStrength('abcdefghijklmnop')
    expect(result.score).toBe(1)
    expect(result.labelKey).toBe('Weak password')
  })

  test('exposes the minimum length and strength constants', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(PASSWORD_MIN_STRENGTH_SCORE).toBe(2)
  })
})
