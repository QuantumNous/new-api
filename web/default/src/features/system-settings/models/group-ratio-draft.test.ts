import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  commitGroupRatioDraft,
  formatGroupRatioDraft,
  isGroupRatioDraft,
  parseGroupRatioDraft,
} from './group-ratio-draft.ts'

describe('group ratio draft input', () => {
  test('allows partial decimal drafts while editing', () => {
    assert.equal(isGroupRatioDraft(''), true)
    assert.equal(isGroupRatioDraft('0.'), true)
    assert.equal(isGroupRatioDraft('.095'), true)
    assert.equal(isGroupRatioDraft('0.095'), true)
  })

  test('rejects drafts that cannot become non-negative ratios', () => {
    assert.equal(isGroupRatioDraft('-0.1'), false)
    assert.equal(isGroupRatioDraft('0..1'), false)
    assert.equal(isGroupRatioDraft('abc'), false)
    assert.equal(isGroupRatioDraft('0.1 '), false)
  })

  test('parses complete decimal drafts without rewriting their display text', () => {
    assert.equal(parseGroupRatioDraft('0.095'), 0.095)
    assert.equal(parseGroupRatioDraft('.095'), 0.095)
    assert.equal(parseGroupRatioDraft('0.'), 0)
    assert.equal(parseGroupRatioDraft('1e3'), null)
    assert.equal(parseGroupRatioDraft(''), null)
  })

  test('normalizes draft only when editing is committed', () => {
    assert.equal(formatGroupRatioDraft(0.095), '0.095')
    assert.equal(commitGroupRatioDraft('.095'), 0.095)
    assert.equal(commitGroupRatioDraft(''), 0)
    assert.equal(commitGroupRatioDraft('.'), 0)
    assert.equal(commitGroupRatioDraft('1e3'), 0)
  })
})
