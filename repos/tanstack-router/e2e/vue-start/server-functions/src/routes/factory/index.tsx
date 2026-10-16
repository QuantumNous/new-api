import { createFileRoute, deepEqual } from '@tanstack/vue-router'

import { createServerFn } from '@tanstack/vue-start'
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
} from './-functions/functions'
import { computed, defineComponent, ref } from 'vue'
import type { PropType } from 'vue'

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
} satisfies Record<string, TestCase>

interface TestCase {
  fn: () => Promise<any>
  expected: any
  type: 'serverFn' | 'localFn'
}
const Test = defineComponent({
  props: {
    fn: {
      type: Function as PropType<() => Promise<any>>,
      required: true,
    },
    expected: {
      type: Object as PropType<any>,
      required: true,
    },
    type: {
      type: String as PropType<TestCase['type']>,
      required: true,
    },
  },
  setup(props) {
    const result = ref<null | unknown>(null)
    const comparison = computed(() => {
      if (result.value) {
        const isEqual = deepEqual(result.value, props.expected)
        return isEqual ? 'equal' : 'not equal'
      }
      return 'Loading...'
    })

    return () => (
      <div
        data-testid={`test-${props.expected.name}`}
        class="p-2 border border-gray-200 rounded-md"
      >
        <h2 class="font-bold text-lg"></h2>
        <div>
          It should return{' '}
          <code>
            <pre data-testid={`expected-fn-result-${props.expected.name}`}>
              {props.type === 'serverFn'
                ? JSON.stringify(props.expected)
                : 'localFn'}
            </pre>
          </code>
        </div>
        <p>
          fn returns:
          <br />
          <span data-testid={`fn-result-${props.expected.name}`}>
            {result.value
              ? props.type === 'serverFn'
                ? JSON.stringify(result.value)
                : 'localFn'
              : 'Loading...'}
          </span>{' '}
          <span data-testid={`fn-comparison-${props.expected.name}`}>
            {comparison.value}
          </span>
        </p>
        <button
          data-testid={`btn-fn-${props.expected.name}`}
          type="button"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={() => {
            props.fn().then((data) => {
              result.value = data
            })
          }}
        >
          Invoke Server Function
        </button>
      </div>
    )
  },
})

const RouteComponent = defineComponent({
  setup() {
    return () => (
      <div class="p-2 m-2 grid gap-2" data-testid="factory-route-component">
        <h1 class="font-bold text-lg">Server functions middleware E2E tests</h1>
        {Object.entries(functions).map(([name, testCase]) => (
          <Test key={name} {...testCase} />
        ))}
      </div>
    )
  },
})

export const Route = createFileRoute('/factory/')({
  ssr: false,
  component: RouteComponent,
})
