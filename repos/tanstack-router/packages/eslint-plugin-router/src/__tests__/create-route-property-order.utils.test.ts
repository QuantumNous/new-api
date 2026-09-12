import { describe, expect, test } from 'vitest'
import {
  getCheckedProperties,
  sortDataByOrder,
} from '../rules/create-route-property-order/create-route-property-order.utils'

describe('create-route-property-order utils', () => {
  describe('sortDataByOrder', () => {
    const testCases = [
      {
        data: [{ key: 'a' }, { key: 'c' }, { key: 'b' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
      },
      {
        data: [{ key: 'b' }, { key: 'a' }, { key: 'c' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
      },
      {
        data: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: null,
      },
      {
        data: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: null,
      },
      {
        data: [{ key: 'a' }, { key: 'b' }, { key: 'd' }, { key: 'c' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: null,
      },
      {
        data: [{ key: 'd' }, { key: 'a' }, { key: 'b' }, { key: 'c' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: null,
      },
      {
        data: [{ key: 'd' }, { key: 'b' }, { key: 'a' }, { key: 'c' }],
        orderArray: [
          [['a'], ['b']],
          [['b'], ['c']],
        ],
        key: 'key',
        expected: [{ key: 'd' }, { key: 'a' }, { key: 'b' }, { key: 'c' }],
      },
      {
        data: [{ key: 'd' }, { key: 'b' }, { key: 'a' }, { key: 'c' }],
        orderArray: [
          [['a', 'b'], ['d']],
          [['d'], ['c']],
        ],
        key: 'key',
        expected: [{ key: 'b' }, { key: 'a' }, { key: 'd' }, { key: 'c' }],
      },
      {
        data: [
          { key: 'd' },
          { key: 'b' },
          { key: 'a' },
          { key: 'c' },
          { key: 'f' },
        ],
        orderArray: [
          [
            ['a', 'b'],
            ['d', 'f'],
          ],
          [['d'], ['c']],
        ],
        key: 'key',
        expected: [
          { key: 'b' },
          { key: 'a' },
          { key: 'd' },
          { key: 'f' },
          { key: 'c' },
        ],
      },
      {
        data: [
          { key: 'd' },
          { key: 'b' },
          { key: 'a' },
          { key: 'c' },
          { key: 'f' },
        ],
        orderArray: [
          [
            ['a', 'b'],
            ['d', 'f'],
          ],
          [['d', 'f'], ['c']],
        ],
        key: 'key',
        expected: [
          { key: 'b' },
          { key: 'a' },
          { key: 'd' },
          { key: 'f' },
          { key: 'c' },
        ],
      },
    ] as const
    test.each(testCases)(
      '$data $orderArray $key $expected',
      ({ data, orderArray, key, expected }) => {
        const sortedData = sortDataByOrder(data, orderArray, key)
        expect(sortedData).toEqual(expected)
      },
    )
  })
})

describe('getCheckedProperties', () => {
  const testCases = [
    {
      orderRules: [
        [['a', 'b'], ['c']],
        [['c'], ['d']],
      ],
      expected: ['a', 'b', 'c', 'd'],
    },
    {
      orderRules: [
        [['a', 'b'], ['c']],
        [['d'], ['e']],
      ],
      expected: ['a', 'b', 'c', 'd', 'e'],
    },
    {
      orderRules: [
        [['a', 'b'], ['c']],
        [['d'], ['e']],
        [['c'], ['f']],
      ],
      expected: ['a', 'b', 'c', 'd', 'e', 'f'],
    },
    {
      orderRules: [
        [['a', 'b'], ['c']],
        [['d'], ['e']],
        [['c'], ['f']],
        [['f'], ['g']],
      ],
      expected: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    },
  ] as const
  test.each(testCases)('$orderRules $expected', ({ orderRules, expected }) => {
    const checkedProperties = getCheckedProperties(orderRules)
    expect(checkedProperties).toEqual(expected)
  })
})
