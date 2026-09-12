import { Link, createFileRoute, deepEqual } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getServerFnCallingPost,
  postServerFnCallingGet,
} from './-functions/serverFnCallingServerFn'

export const Route = createFileRoute('/function-method/')({
  component: RouteComponent,
})

const functions = {
  getServerFnCallingPost: {
    fn: getServerFnCallingPost,
    expected: {
      name: 'getServerFnCallingPost',
      method: 'GET',
      innerFnResult: {
        method: 'POST',
      },
    },
  },
  postServerFnCallingGet: {
    fn: postServerFnCallingGet,
    expected: {
      name: 'postServerFnCallingGet',
      method: 'POST',
      innerFnResult: {
        method: 'GET',
      },
    },
  },
} satisfies Record<string, TestCase>

function RouteComponent() {
  return (
    <div className="p-2 m-2 grid gap-2" data-testid="method-route-component">
      <h1 className="font-bold text-lg">Server functions methods E2E tests</h1>
      <div>
        <Link className="inline" to="/factory">
          <h2>Go to Factory Functions and request method E2E test</h2>
        </Link>
      </div>
      {Object.entries(functions).map(([name, testCase]) => (
        <Test key={name} {...testCase} />
      ))}
    </div>
  )
}

interface TestCase {
  fn: () => Promise<any>
  expected: any
}
function Test({ fn, expected }: TestCase) {
  const [result, setResult] = useState<null | unknown>(null)
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
      <div>
        It should return{' '}
        <code>
          <pre data-testid={`expected-fn-result-${expected.name}`}>
            {JSON.stringify(expected)}
          </pre>
        </code>
      </div>
      <p>
        fn returns:
        <br />
        <span data-testid={`fn-result-${expected.name}`}>
          {result ? JSON.stringify(result) : 'Loading...'}
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
