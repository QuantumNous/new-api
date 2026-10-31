import { Link } from '@tanstack/vue-router'
import { defineComponent } from 'vue'

export const NotFound = defineComponent({
  props: {
    children: {
      type: String,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="space-y-2 p-2" data-testid="default-not-found-component">
        <div class="text-gray-600 dark:text-gray-400">
          {slots.default ? (
            slots.default()
          ) : (
            <p>The page you are looking for does not exist.</p>
          )}
        </div>
        <p class="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.history.back()}
            class="bg-emerald-500 text-white px-2 py-1 rounded-sm uppercase font-black text-sm"
          >
            Go back
          </button>
          <Link
            to="/"
            class="bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm"
          >
            Start Over
          </Link>
        </p>
      </div>
    )
  },
})
