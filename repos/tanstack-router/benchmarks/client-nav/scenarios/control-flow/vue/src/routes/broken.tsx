import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { errorMessage } from '../../../shared'

const BrokenError = Vue.defineComponent({
  props: {
    error: { type: Error, required: true },
  },
  setup(props) {
    return () => <div data-testid="error-state">{props.error.message}</div>
  },
})

export const Route = createFileRoute('/broken')({
  staleTime: 0,
  gcTime: 0,
  loader: () => {
    throw new Error(errorMessage)
  },
  errorComponent: BrokenError,
})
