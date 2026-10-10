import { createFileRoute, deepEqual } from '@tanstack/react-router'

import React from 'react'
import { createServerFn } from '@tanstack/react-start'
import { fooFnInsideFactoryFile } from './-functions/createFooServerFn'
import {
  barFn,
  barFnPOST,
  composedFn,
  fakeFn,
  fooFn,
  fooFnPOST,
  localFn,
  localFnPOST,
  nestedReexportedFactoryFn,
  reexportedFactoryFn,
  starReexportedFactoryFn,
} from './-functions/functions'

export const Route = createFileRoute('/factory/')({
  ssr: false,
  component: RouteComponent,
})

const fnInsideRoute = createServerFn({ method: 'GET' }).handler(
  ({ method }) => {
    return {
      name: 'fnInsideRoute',
      method,
    }
  },
)

const functions = {
  fnInsideRoute: {
    fn: fnInsideRoute,
    type: 'serverFn',
    expected: {
      name: 'fnInsideRoute',
      method: 'GET',
    },
  },
  fooFnInsideFactoryFile: {
    fn: fooFnInsideFactoryFile,
    type: 'serverFn',

    expected: {
      name: 'fooFnInsideFactoryFile',
      context: { foo: 'foo', method: 'GET' },
      method: 'GET',
    },
  },
  fooFn: {
    fn: fooFn,
    type: 'serverFn',

    expected: {
      name: 'fooFn',
      context: { foo: 'foo', method: 'GET' },
      method: 'GET',
    },
  },
  fooFnPOST: {
    fn: fooFnPOST,
    type: 'serverFn',

    expected: {
      name: 'fooFnPOST',
      context: { foo: 'foo', method: 'POST' },
      method: 'POST',
    },
  },
  barFn: {
    fn: barFn,
    type: 'serverFn',

    expected: {
      name: 'barFn',
      context: { foo: 'foo', method: 'GET', bar: 'bar' },
      method: 'GET',
    },
  },
  barFnPOST: {
    fn: barFnPOST,
    type: 'serverFn',

    expected: {
      name: 'barFnPOST',
      context: { foo: 'foo', method: 'POST', bar: 'bar' },
      method: 'POST',
    },
  },
  localFn: {
    fn: localFn,
    type: 'serverFn',

    expected: {
      name: 'localFn',
      context: {
        foo: 'foo',
        method: 'GET',
        bar: 'bar',
        local: 'local',
        another: 'another',
      },
      method: 'GET',
    },
  },
  localFnPOST: {
    fn: localFnPOST,
    type: 'serverFn',

    expected: {
      name: 'localFnPOST',
      context: {
        foo: 'foo',
        method: 'POST',
        bar: 'bar',
        local: 'local',
        another: 'another',
      },
      method: 'POST',
    },
  },
  composedFn: {
    fn: composedFn,
    type: 'serverFn',
    expected: {
      name: 'composedFn',
      context: {
        foo: 'foo',
        method: 'GET',
        bar: 'bar',
        another: 'another',
        local: 'local',
      },
      method: 'GET',
    },
  },
  fakeFn: {
    fn: fakeFn,
    type: 'localFn',
    expected: {
      name: 'fakeFn',
      window,
    },
  },
  // Test that re-exported factories (using `export { foo } from './module'`) work correctly
  // The middleware from reexportFactory should execute and add { reexport: 'reexport-middleware-executed' } to context
  reexportedFactoryFn: {
    fn: reexportedFactoryFn,
    type: 'serverFn',
    expected: {
      name: 'reexportedFactoryFn',
      context: { reexport: 'reexport-middleware-executed' },
      method: 'GET',
    },
  },
  // Test that star re-exported factories (using `export * from './module'`) work correctly
  // The middleware from starReexportFactory should execute and add { starReexport: 'star-reexport-middleware-executed' } to context
  starReexportedFactoryFn: {
    fn: starReexportedFactoryFn,
    type: 'serverFn',
    expected: {
      name: 'starReexportedFactoryFn',
      context: { starReexport: 'star-reexport-middleware-executed' },
      method: 'GET',
    },
  },
  // Test that nested star re-exported factories (A -> B -> C chain) work correctly
  // The middleware from nestedReexportFactory should execute and add { nested: 'nested-middleware-executed' } to context
  nestedReexportedFactoryFn: {
    fn: nestedReexportedFactoryFn,
    type: 'serverFn',
    expected: {
      name: 'nestedReexportedFactoryFn',
      context: { nested: 'nested-middleware-executed' },
      method: 'GET',
    },
  },
} satisfies Record<string, TestCase>

interface TestCase {
  fn: () => Promise<any>
  expected: any
  type: 'serverFn' | 'localFn'
}
function Test({ fn, type, expected }: TestCase) {
  const [result, setResult] = React.useState<null | unknown>(null)
  function comparison() {
    if (result) {
      const isEqual = deepEqual(result, expected)
      return isEqual ? 'equal' : 'not equal'
    }
    return 'Loading...'
  }

  return (
    <div
      data-testid={`test-${expected.name}`}
      className="p-2 border border-gray-200 rounded-md"
    >
      <h2 className="font-bold text-lg"></h2>
      <div>
        It should return{' '}
        <code>
          <pre data-testid={`expected-fn-result-${expected.name}`}>
            {type === 'serverFn' ? JSON.stringify(expected) : 'localFn'}
          </pre>
        </code>
      </div>
      <p>
        fn returns:
        <br />
        <span data-testid={`fn-result-${expected.name}`}>
          {result
            ? type === 'serverFn'
              ? JSON.stringify(result)
              : 'localFn'
            : 'Loading...'}
        </span>{' '}
        <span data-testid={`fn-comparison-${expected.name}`}>
          {comparison()}
        </span>
      </p>
      <button
        data-testid={`btn-fn-${expected.name}`}
        type="button"
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={() => {
          fn().then(setResult)
        }}
      >
        Invoke Server Function
      </button>
    </div>
  )
}
function RouteComponent() {
  return (
    <div className="p-2 m-2 grid gap-2" data-testid="factory-route-component">
      <h1 className="font-bold text-lg">Server functions factory E2E tests</h1>
      {Object.entries(functions).map(([name, testCase]) => (
        <Test key={name} {...testCase} />
      ))}
    </div>
  )
}
