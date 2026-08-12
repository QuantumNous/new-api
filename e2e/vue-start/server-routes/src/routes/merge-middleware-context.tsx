import { createFileRoute } from '@tanstack/vue-router'
import { defineComponent, ref } from 'vue'

const MergeMiddlewareContext = defineComponent({
  name: 'MergeMiddlewareContext',
  setup() {
    const apiResponse = ref<any>(null)

    const fetchMiddlewareContext = async () => {
      try {
        const response = await fetch('/api/middleware-context')
        const data = await response.json()
        apiResponse.value = data
      } catch (error) {
        console.error('Error fetching middleware context:', error)
        apiResponse.value = { error: 'Failed to fetch' }
      }
    }

    return () => (
      <div class="p-2 m-2 grid gap-2">
        <h3>Merge Server Route Middleware Context Test</h3>
        <div class="flex flex-col gap-2">
          <button
            type="button"
            onClick={fetchMiddlewareContext}
            data-testid="test-middleware-context-btn"
            class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Test Middleware Context
          </button>

          {apiResponse.value ? (
            <div class="mt-4">
              <h4>API Response:</h4>
              <pre
                data-testid="api-response"
                class="bg-gray-100 p-2 rounded-sm text-black"
              >
                {JSON.stringify(apiResponse.value, null, 2)}
              </pre>

              <div class="mt-4 grid gap-2">
                <h4>Context Verification:</h4>
                <div
                  data-testid="context-result"
                  class="bg-gray-100 p-2 rounded-sm text-black"
                >
                  {JSON.stringify(apiResponse.value?.context, null, 2)}
                </div>

                <div
                  data-testid="has-test-parent"
                  class="p-2 border rounded-sm"
                >
                  Has testParent:{' '}
                  {apiResponse.value?.context?.testParent ? 'true' : 'false'}
                </div>

                <div data-testid="has-test" class="p-2 border rounded-sm">
                  Has test:{' '}
                  {apiResponse.value?.context?.test ? 'true' : 'false'}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/merge-middleware-context')({
  component: MergeMiddlewareContext,
})
