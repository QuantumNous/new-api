import { useServerFn } from '@tanstack/vue-start'
import { throwRedirect } from './throwRedirect'
import { defineComponent } from 'vue'

export const RedirectOnClick = defineComponent({
  props: {
    target: {
      type: String as () => 'internal' | 'external',
      required: true,
    },
    reloadDocument: {
      type: Boolean,
      default: undefined,
    },
    externalHost: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const execute = useServerFn(throwRedirect)
    return () => (
      <button
        data-testid="redirect-on-click"
        onClick={() =>
          execute({
            data: {
              target: props.target,
              reloadDocument: props.reloadDocument,
              externalHost: props.externalHost,
            },
          })
        }
      >
        click me
      </button>
    )
  },
})
