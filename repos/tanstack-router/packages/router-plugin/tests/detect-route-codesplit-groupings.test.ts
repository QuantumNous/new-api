import { describe, expect, it } from 'vitest'
import { detectCodeSplitGroupingsFromRoute } from '../src/core/code-splitter/compilers'
import { defaultCodeSplitGroupings } from '../src/core/constants'
import type { CodeSplitGroupings } from '../src/core/constants'

const successCases: Array<{
  name: string
  code: string
  expectedGrouping: CodeSplitGroupings | undefined
}> = [
  {
    // This test should be updated whenever the `defaultCodeSplitGroupings` changes
    name: 'verbose:true-defaults',
    code: `
import {createFileRoute} from '@tanstack/react-router'
export const Route = createFileRoute('/posts')({
codeSplitGroupings: [
  ['component'],
  ['errorComponent'],
  ['notFoundComponent']
]
})
`,
    expectedGrouping: defaultCodeSplitGroupings,
  },
  {
    // This test should be updated whenever the `defaultCodeSplitGroupings` changes
    name: 'verbose:false-defaults',
    code: `
export const Route = createFileRoute({
codeSplitGroupings: [
  ['component'],
  ['errorComponent'],
  ['notFoundComponent']
]
})
`,
    expectedGrouping: defaultCodeSplitGroupings,
  },
  {
    name: 'verbose:true-loader-separate-components-combined',
    code: `
import {createFileRoute} from '@tanstack/react-router'
export const Route = createFileRoute('/posts')({
codeSplitGroupings: [
  ['loader'],
  ['component', 'pendingComponent', 'errorComponent', 'notFoundComponent']
]
})
`,
    expectedGrouping: [
      ['loader'],
      ['component', 'pendingComponent', 'errorComponent', 'notFoundComponent'],
    ],
  },
  {
    name: 'verbose:false-loader-separate-components-combined',
    code: `
export const Route = createFileRoute({
codeSplitGroupings: [
  ['loader'],
  ['component', 'pendingComponent', 'errorComponent', 'notFoundComponent']
]
})
`,
    expectedGrouping: [
      ['loader'],
      ['component', 'pendingComponent', 'errorComponent', 'notFoundComponent'],
    ],
  },
  {
    name: 'verbose:true-limited-loader-and-component',
    code: `
import {createFileRoute} from '@tanstack/react-router'
export const Route = createFileRoute('/posts')({
codeSplitGroupings: [
  ['loader', 'component'],
  ['pendingComponent', 'errorComponent', 'notFoundComponent']
]
})
`,
    expectedGrouping: [
      ['loader', 'component'],
      ['pendingComponent', 'errorComponent', 'notFoundComponent'],
    ],
  },
  {
    name: 'verbose:false-limited-loader-and-component',
    code: `
export const Route = createFileRoute({
codeSplitGroupings: [
  ['loader', 'component'],
  ['pendingComponent', 'errorComponent', 'notFoundComponent']
]
})
`,
    expectedGrouping: [
      ['loader', 'component'],
      ['pendingComponent', 'errorComponent', 'notFoundComponent'],
    ],
  },
  {
    name: 'verbose:true-empty',
    code: `
import {createFileRoute} from '@tanstack/react-router'
export const Route = createFileRoute('/posts')({})
`,
    expectedGrouping: undefined,
  },
  {
    name: 'verbose:false-empty',
    code: `
export const Route = createFileRoute({})
`,
    expectedGrouping: undefined,
  },
]

describe('detectCodeSplitGroupingsFromRoute - success', () => {
  it.each(successCases)(
    'should detect code split groupings for $name',
    ({ code, expectedGrouping }) => {
      const result = detectCodeSplitGroupingsFromRoute({
        code: code,
        sourceFilename: 'test.ts',
      })

      expect(result.groupings).toEqual(expectedGrouping)
    },
  )
})

const failCases: Array<{
  name: string
  code: string
}> = [
  {
    name: 'verbose:true-not-nested-array',
    code: `
  import {createFileRoute} from '@tanstack/react-router'
  export const Route = createFileRoute('/')({
  codeSplitGroupings: [
      'loader',
  ]
  })
  `,
  },
  {
    name: 'verbose:false-not-nested-array',
    code: `
  export const Route = createFileRoute({
  codeSplitGroupings: [
      'loader',
  ]
  })
  `,
  },
  {
    name: 'verbose:true-reference-variable',
    code: `
import {createFileRoute} from '@tanstack/react-router'
const groupings = [
  ['loader'],
  ['component'],
]
export const Route = createFileRoute('/')({
codeSplitGroupings: groupings
})
`,
  },
  {
    name: 'verbose:false-reference-variable',
    code: `
const groupings = [
  ['loader'],
  ['component'],
]
export const Route = createFileRoute({
codeSplitGroupings: groupings
})
`,
  },
]

describe('detectCodeSplitGroupingsFromRoute - fail', () => {
  it.each(failCases)('should throw error for $name', ({ code }) => {
    expect(() =>
      detectCodeSplitGroupingsFromRoute({
        code: code,
        sourceFilename: 'test.ts',
      }),
    ).toThrowError()
  })
})
