import { ref, onMounted, defineComponent } from 'vue'
import { useSearch, useNavigate } from '@tanstack/vue-router'

// Module-scoped ref to persist across component remounts
const mounts = ref(0)

export const RemountDepsComponent = defineComponent({
  setup() {
    const search = useSearch({ from: '/remountDeps' })
    const navigate = useNavigate()

    onMounted(() => {
      mounts.value++
    })

    return () => (
      <div class="p-2">
        <button
          onClick={() =>
            navigate({
              to: '/remountDeps',
              search: {
                searchParam: Math.random().toString(36).substring(2, 8),
              },
            })
          }
        >
          Regenerate search param
        </button>

        <div>Search: {search.value.searchParam}</div>
        <div data-testid="component-mounts">
          Page component mounts: {mounts.value}
        </div>
      </div>
    )
  },
})
