import {
  ErrorComponent,
  Link,
  useLocation,
  useRouter,
} from '@tanstack/vue-router'
import { defineComponent } from 'vue'

export const DefaultCatchBoundary = defineComponent({
  props: {
    error: {
      type: Error,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter()
    const isRoot = useLocation({
      select: (location) => location.pathname === '/',
    })

    console.error(props.error)

    return () => (
      <div class="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
        <ErrorComponent error={props.error} />
        <div class="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => {
              router.invalidate()
            }}
            class={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
          >
            Try Again
          </button>
          {isRoot.value ? (
            <Link
              to="/"
              class={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
            >
              Home
            </Link>
          ) : (
            <Link
              to="/"
              class={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
              onClick={(e: MouseEvent) => {
                e.preventDefault()
                window.history.back()
              }}
            >
              Go Back
            </Link>
          )}
        </div>
      </div>
    )
  },
})
