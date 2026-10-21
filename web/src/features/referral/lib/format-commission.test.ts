/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import {
  centsToYuan,
  computeQuotaCredit,
  yuanToCents,
} from './format-commission'

describe('centsToYuan', () => {
  test('formats to 2 decimals', () => {
    assert.equal(centsToYuan(2500), '25.00')
    assert.equal(centsToYuan(1), '0.01')
    assert.equal(centsToYuan(0), '0.00')
  })
})

describe('yuanToCents', () => {
  test('rounds cleanly', () => {
    assert.equal(yuanToCents(25), 2500)
    assert.equal(yuanToCents(0.1 + 0.2), 30)
  })
})

describe('computeQuotaCredit', () => {
  test('mirrors the backend floor math', () => {
    // ¥25 @ rate=7.2, qpu=500000 → 25/7.2*500000 = 1_736_111.11 → floor 1_736_111
    assert.equal(computeQuotaCredit(2500, 7.2, 500000), 1736111)
  })
  test('invalid inputs return 0', () => {
    assert.equal(computeQuotaCredit(0, 7.2, 500000), 0)
    assert.equal(computeQuotaCredit(2500, 0, 500000), 0)
    assert.equal(computeQuotaCredit(2500, 7.2, 0), 0)
    assert.equal(computeQuotaCredit(-1, 7.2, 500000), 0)
  })
})
