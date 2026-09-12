import { createFileRoute, useLocation } from '@tanstack/vue-router'
import { defineComponent, ref } from 'vue'

const RouteComponent = defineComponent({
  setup() {
    const l = useLocation()
    const toggleHashValue = ref(false)

    const toggle = () => {
      toggleHashValue.value = !toggleHashValue.value
    }

    return () => (
      <div data-testid="special-hash-heading">
        <div>Hello "/specialChars/hash"!</div>
        <button
          class={
            'mt-2 mb-2 px-1 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition duration-200'
          }
          data-testid="toggle-hash-button"
          onClick={toggle}
        >
          Toggle HashValue
        </button>
        <div>
          {toggleHashValue.value && (
            <div>
              Hash Value<span data-testid="special-hash">{l.value.hash}</span>
            </div>
          )}
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/specialChars/hash')({
  component: RouteComponent,
})
