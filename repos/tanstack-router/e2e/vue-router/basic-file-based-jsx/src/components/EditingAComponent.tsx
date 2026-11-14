import { ref, defineComponent } from 'vue'
import { useBlocker, useNavigate } from '@tanstack/vue-router'

export const EditingAComponent = defineComponent({
  setup() {
    const navigate = useNavigate()
    const input = ref('')

    const blocker = useBlocker({
      shouldBlockFn: ({ next }) => {
        if (next.fullPath === '/editing-b' && input.value.length > 0) {
          return true
        }
        return false
      },
      withResolver: true,
    })

    return () => (
      <div>
        <h1>Editing A</h1>
        <label>
          Enter your name:
          <input
            name="input"
            value={input.value}
            onInput={(e) =>
              (input.value = (e.target as HTMLInputElement).value)
            }
          />
        </label>
        <button onClick={() => navigate({ to: '/editing-b' })}>
          Go to next step
        </button>
        {blocker.value.status === 'blocked' && (
          <button onClick={() => blocker.value.proceed?.()}>Proceed</button>
        )}
      </div>
    )
  },
})
