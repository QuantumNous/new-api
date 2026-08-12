import { ref, toValue, defineComponent } from 'vue'
import { useBlocker, useNavigate } from '@tanstack/vue-router'

export const EditingBComponent = defineComponent({
  setup() {
    const navigate = useNavigate()
    const input = ref('')

    const blocker = useBlocker({
      shouldBlockFn: () => !!toValue(input),
      withResolver: true,
    })

    return () => (
      <div>
        <h1>Editing B</h1>
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
        <button onClick={() => navigate({ to: '/editing-a' })}>Go back</button>
        {blocker.value.status === 'blocked' && (
          <button onClick={() => blocker.value.proceed?.()}>Proceed</button>
        )}
      </div>
    )
  },
})
