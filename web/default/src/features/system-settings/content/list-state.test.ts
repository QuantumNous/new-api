import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getNextItemId, removeItemsById, upsertItem } from './list-state.ts'

describe('content list state helpers', () => {
  test('creates the next list for immediate save after adding an item', () => {
    const current = [{ id: 1, content: 'old' }]
    const next = upsertItem(current, { id: getNextItemId(current), content: 'new' })

    assert.deepEqual(next, [
      { id: 1, content: 'old' },
      { id: 2, content: 'new' },
    ])
    assert.deepEqual(current, [{ id: 1, content: 'old' }])
  })

  test('creates the next list for immediate save after editing an item', () => {
    const current = [
      { id: 1, question: 'old question', answer: 'old answer' },
      { id: 2, question: 'kept question', answer: 'kept answer' },
    ]

    const next = upsertItem(current, {
      id: 1,
      question: 'new question',
      answer: 'new answer',
    })

    assert.deepEqual(next, [
      { id: 1, question: 'new question', answer: 'new answer' },
      { id: 2, question: 'kept question', answer: 'kept answer' },
    ])
  })

  test('creates the next list for immediate save after deleting items', () => {
    const current = [
      { id: 1, url: 'https://a.example.com' },
      { id: 2, url: 'https://b.example.com' },
      { id: 3, url: 'https://c.example.com' },
    ]

    assert.deepEqual(removeItemsById(current, [1, 3]), [
      { id: 2, url: 'https://b.example.com' },
    ])
  })
})
