import { RuleTester } from '@typescript-eslint/rule-tester'
import combinate from 'combinate'

import {
  name,
  rule,
} from '../rules/create-route-property-order/create-route-property-order.rule'
import {
  checkedProperties,
  createRouteFunctionsDirect,
  createRouteFunctionsIndirect,
} from '../rules/create-route-property-order/constants'
import {
  generateInterleavedCombinations,
  generatePartialCombinations,
  generatePermutations,
  normalizeIndent,
} from './test-utils'

const ruleTester = new RuleTester()

// reduce the number of test cases by only testing a subset of the checked properties
const testedCheckedProperties = [
  checkedProperties[0]!,
  checkedProperties[1]!,
  checkedProperties[2]!,
  checkedProperties[3]!,
]
type TestedCheckedProperties = (typeof testedCheckedProperties)[number]
const orderIndependentProps = ['gcTime', '...foo'] as const
type OrderIndependentProps = (typeof orderIndependentProps)[number]

// reduce the number of test cases by only testing the first function of createRouteFunctionsDirect
const testedCreateRouteFunctions = [
  ...createRouteFunctionsIndirect,
  createRouteFunctionsDirect[0],
]
type TestedCreateRouteFunction = (typeof testedCreateRouteFunctions)[number]

interface TestCase {
  createRouteFunction: TestedCreateRouteFunction
  properties: Array<TestedCheckedProperties | OrderIndependentProps>
}

const validTestMatrix = combinate({
  createRouteFunction: testedCreateRouteFunctions,
  properties: generatePartialCombinations(testedCheckedProperties, 2),
})

export function generateInvalidPermutations(
  arr: ReadonlyArray<TestedCheckedProperties>,
): Array<{
  invalid: Array<TestedCheckedProperties>
  valid: Array<TestedCheckedProperties>
}> {
  const combinations = generatePartialCombinations(arr, 2)
  const allPermutations: Array<{
    invalid: Array<TestedCheckedProperties>
    valid: Array<TestedCheckedProperties>
  }> = []

  for (const combination of combinations) {
    const permutations = generatePermutations(combination)
    // skip the first permutation as it matches the original combination
    const invalidPermutations = permutations.slice(1)

    if (
      combination.includes('params') &&
      combination.includes('validateSearch')
    ) {
      if (
        combination.indexOf('params') < combination.indexOf('validateSearch')
      ) {
        // since we ignore the relative order of 'params' and 'validateSearch', we skip this combination (but keep the other one where `validateSearch` is before `params`)
        continue
      }
    }

    allPermutations.push(
      ...invalidPermutations.map((p) => {
        // ignore the relative order of 'params' and 'validateSearch'
        const correctedValid = [...combination].sort((a, b) => {
          if (
            (a === 'params' && b === 'validateSearch') ||
            (a === 'validateSearch' && b === 'params')
          ) {
            return p.indexOf(a) - p.indexOf(b)
          }
          return checkedProperties.indexOf(a) - checkedProperties.indexOf(b)
        })
        return { invalid: p, valid: correctedValid }
      }),
    )
  }

  return allPermutations
}

const invalidPermutations = generateInvalidPermutations(testedCheckedProperties)

type Interleaved = TestedCheckedProperties | OrderIndependentProps
const interleavedInvalidPermutations: Array<{
  invalid: Array<Interleaved>
  valid: Array<Interleaved>
}> = []
for (const invalidPermutation of invalidPermutations) {
  const invalid = generateInterleavedCombinations(
    invalidPermutation.invalid,
    orderIndependentProps,
  )
  const valid = generateInterleavedCombinations(
    invalidPermutation.valid,
    orderIndependentProps,
  )

  for (let i = 0; i < invalid.length; i++) {
    interleavedInvalidPermutations.push({
      invalid: invalid[i]!,
      valid: valid[i]!,
    })
  }
}

const invalidTestMatrix = combinate({
  createRouteFunction: testedCreateRouteFunctions,
  properties: interleavedInvalidPermutations,
})

function getCode({ createRouteFunction, properties }: TestCase) {
  let invocation = ''
  switch (createRouteFunction) {
    case 'createFileRoute': {
      invocation = `('/_layout/hello/foo/$id')`
      break
    }
    case 'createRootRouteWithContext': {
      invocation = normalizeIndent`
      <{
          queryClient: QueryClient
       }>()`
      break
    }
  }
  function getPropertyCode(
    property: TestedCheckedProperties | OrderIndependentProps,
  ) {
    if (property.startsWith('...')) {
      return property
    }
    return `${property}: () => null`
  }
  return `
    import { ${createRouteFunction} } from '@tanstack/react-router'

    const Route = ${createRouteFunction}${invocation}({
        ${properties.map(getPropertyCode).join(',\n        ')}
    })
  `
}

const validTestCases = validTestMatrix.map(
  ({ createRouteFunction, properties }) => ({
    name: `should pass when order is correct for ${createRouteFunction} with order: ${properties.join(', ')}`,
    code: getCode({ createRouteFunction, properties }),
  }),
)

invalidTestMatrix.push({
  createRouteFunction: 'createFileRoute',
  properties: {
    invalid: ['loader', 'loaderDeps'],
    valid: ['loaderDeps', 'loader'],
  },
})

invalidTestMatrix.push({
  createRouteFunction: 'createFileRoute',
  properties: { invalid: ['head', 'loader'], valid: ['loader', 'head'] },
})

const invalidTestCases = invalidTestMatrix.map(
  ({ createRouteFunction, properties }) => ({
    name: `incorrect property order is detected for ${createRouteFunction} with order: ${properties.invalid.join(', ')}`,
    code: getCode({
      createRouteFunction,
      properties: properties.invalid,
    }),
    errors: [{ messageId: 'invalidOrder' }],
    output: getCode({
      createRouteFunction,
      properties: properties.valid,
    }),
  }),
)

ruleTester.run(name, rule, {
  valid: validTestCases,
  invalid: invalidTestCases,
})
