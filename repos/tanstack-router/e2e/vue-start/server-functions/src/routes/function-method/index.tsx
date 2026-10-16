import { Link, createFileRoute, deepEqual } from '@tanstack/vue-router'
import { computed, defineComponent, ref } from 'vue'
import {
  getServerFnCallingPost,
  postServerFnCallingGet,
} from './-functions/serverFnCallingServerFn'
import type { PropType } from 'vue'

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

interface TestCase {
  fn: () => Promise<any>
  expected: any
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
        <div>
          It should return{' '}
          <code>
            <pre data-testid={`expected-fn-result-${props.expected.name}`}>
              {JSON.stringify(props.expected)}
            </pre>
          </code>
        </div>
        <p>
          fn returns:
          <br />
          <span data-testid={`fn-result-${props.expected.name}`}>
            {result.value ? JSON.stringify(result.value) : 'Loading...'}
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
      <div class="p-2 m-2 grid gap-2" data-testid="method-route-component">
        <h1 class="font-bold text-lg">Server functions methods E2E tests</h1>
        <div>
          <Link class="inline" to="/factory">
            <h2>Go to Factory Functions and request method E2E test</h2>
          </Link>
        </div>
        {Object.entries(functions).map(([name, testCase]) => (
          <Test key={name} {...testCase} />
        ))}
      </div>
    )
  },
})

export const Route = createFileRoute('/function-method/')({
  component: RouteComponent,
})
