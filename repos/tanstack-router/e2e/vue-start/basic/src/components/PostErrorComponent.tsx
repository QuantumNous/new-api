import { ErrorComponent } from '@tanstack/vue-router'
import type { ErrorComponentProps } from '@tanstack/vue-router'
import { defineComponent } from 'vue'

export const PostErrorComponent = defineComponent({
  props: {
    error: {
      type: Error,
      required: true,
    },
  },
  setup(props) {
    return () => <ErrorComponent error={props.error} />
  },
})
