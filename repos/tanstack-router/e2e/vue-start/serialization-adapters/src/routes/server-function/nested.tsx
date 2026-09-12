import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { defineComponent, ref } from 'vue'
import type { NestedOuter } from '~/data'
import { RenderNestedData, makeNested } from '~/data'

const serverFnReturningNested = createServerFn().handler(() => {
  return makeNested()
})

const RouteComponent = defineComponent({
  name: 'ServerFunctionNestedRoute',
  setup() {
    const nestedResponse = ref<NestedOuter>()

    return () => (
      <div>
        <button
          data-testid="server-function-trigger"
          onClick={() =>
            serverFnReturningNested().then(
              (res) => (nestedResponse.value = res),
            )
          }
        >
          trigger
        </button>

        {nestedResponse.value ? (
          <RenderNestedData nested={nestedResponse.value} />
        ) : (
          <div data-testid="waiting-for-response">waiting for response...</div>
        )}
      </div>
    )
  },
})

export const Route = createFileRoute('/server-function/nested')({
  component: RouteComponent,
})
