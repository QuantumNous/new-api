import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { FlowUserFilterOption } from '../types'
import {
  compactFlowSelectionLabel,
  flowDisplayState,
  requireSuccessfulFlowRows,
  selectedTokenValuesForUser,
  updateSelectedTokensForUser,
  visibleFlowUsers,
} from './flow-selection'

const users: FlowUserFilterOption[] = [
  {
    value: 'user:1',
    label: 'dry',
    valueLabel: '100',
    valueRaw: 100,
    color: '#1664ff',
    tokens: [
      {
        value: 'token:11',
        label: 'dry-primary',
        valueLabel: '80',
        valueRaw: 80,
      },
      {
        value: 'token:12',
        label: 'dry-backup',
        valueLabel: '20',
        valueRaw: 20,
      },
    ],
  },
  {
    value: 'user:2',
    label: 'jrc',
    valueLabel: '70',
    valueRaw: 70,
    color: '#1ac6ff',
    tokens: [
      {
        value: 'token:22',
        label: 'jrc-key',
        valueLabel: '70',
        valueRaw: 70,
      },
    ],
  },
]

describe('dashboard flow selection helpers', () => {
  test('limits user chips to currently visible users', () => {
    assert.deepEqual(
      visibleFlowUsers(users, []).map((user) => user.value),
      ['user:1', 'user:2']
    )
    assert.deepEqual(
      visibleFlowUsers(users, ['user:2']).map((user) => user.value),
      ['user:2']
    )
  })

  test('updates token selections independently per user', () => {
    const selected = updateSelectedTokensForUser({}, 'user:1', ['token:12'])
    assert.deepEqual(selected, { 'user:1': ['token:12'] })
    assert.deepEqual(selectedTokenValuesForUser(selected, 'user:1'), [
      'token:12',
    ])

    const next = updateSelectedTokensForUser(selected, 'user:2', ['token:22'])
    assert.deepEqual(next, {
      'user:1': ['token:12'],
      'user:2': ['token:22'],
    })
  })

  test('keeps hidden user token selections available for later visibility', () => {
    const selected = {
      'user:1': ['token:12'],
      'user:2': ['token:22'],
    }

    assert.deepEqual(
      visibleFlowUsers(users, ['user:1']).map((user) => user.value),
      ['user:1']
    )
    assert.deepEqual(selectedTokenValuesForUser(selected, 'user:2'), [
      'token:22',
    ])
  })

  test('removes a user token override when no tokens are selected', () => {
    const selected = {
      'user:1': ['token:12'],
      'user:2': ['token:22'],
    }
    const next = updateSelectedTokensForUser(selected, 'user:1', [])

    assert.deepEqual(next, { 'user:2': ['token:22'] })
    assert.deepEqual(selectedTokenValuesForUser(next, 'user:1'), [])
  })

  test('formats compact selected counts for flow multiselect summaries', () => {
    assert.equal(compactFlowSelectionLabel(0), '*')
    assert.equal(compactFlowSelectionLabel(1), '1')
    assert.equal(compactFlowSelectionLabel(23), '23')
  })

  test('prioritizes loading and error states before empty flow data', () => {
    assert.equal(
      flowDisplayState({
        isLoading: true,
        isError: true,
        linkCount: 0,
        themeReady: true,
      }),
      'loading'
    )
    assert.equal(
      flowDisplayState({
        isLoading: false,
        isError: true,
        linkCount: 0,
        themeReady: true,
      }),
      'error'
    )
    assert.equal(
      flowDisplayState({
        isLoading: false,
        isError: false,
        linkCount: 0,
        themeReady: true,
      }),
      'empty'
    )
    assert.equal(
      flowDisplayState({
        isLoading: false,
        isError: false,
        linkCount: 1,
        themeReady: false,
      }),
      'loading'
    )
  })

  test('throws unsuccessful flow responses instead of treating them as empty data', () => {
    assert.throws(
      () =>
        requireSuccessfulFlowRows(
          { success: false, data: [], message: 'database unavailable' },
          'Failed to load'
        ),
      /database unavailable/
    )
    assert.deepEqual(
      requireSuccessfulFlowRows(
        { success: true, data: [{ user_id: 1, quota: 10 }] },
        'Failed to load'
      ),
      [{ user_id: 1, quota: 10 }]
    )
  })
})
