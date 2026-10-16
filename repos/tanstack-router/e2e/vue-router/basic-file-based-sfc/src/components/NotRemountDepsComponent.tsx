import { ref, onMounted, defineComponent } from 'vue'
import { useSearch, useNavigate } from '@tanstack/vue-router'

export const NotRemountDepsComponent = defineComponent({
  setup() {
    // Component-scoped ref - will be recreated on component remount
    const mounts = ref(0)
    const search = useSearch({ from: '/notRemountDeps' })
    const navigate = useNavigate()

    onMounted(() => {
      mounts.value++
    })

    return () => (
      <div class="p-2">
        <button
          onClick={() =>
            navigate({
              to: '/notRemountDeps',
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
