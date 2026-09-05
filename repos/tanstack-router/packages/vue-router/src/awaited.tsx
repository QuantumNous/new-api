import * as Vue from 'vue'

import { TSR_DEFERRED_PROMISE, defer } from '@tanstack/router-core'
import type { DeferredPromise } from '@tanstack/router-core'

export type AwaitOptions<T> = {
  promise: Promise<T>
}

export function useAwaited<T>({
  promise: _promise,
}: AwaitOptions<T>): [T, DeferredPromise<T>] {
  const promise = defer(_promise)

  if (promise[TSR_DEFERRED_PROMISE].status === 'pending') {
    throw promise
  }

  if (promise[TSR_DEFERRED_PROMISE].status === 'error') {
    throw promise[TSR_DEFERRED_PROMISE].error
  }

  return [promise[TSR_DEFERRED_PROMISE].data, promise]
}

export const Await = Vue.defineComponent({
  name: 'Await',
  props: {
    promise: {
      type: Promise,
      required: true,
    },
    children: {
      type: Function,
      required: true,
    },
  },
  async setup(props) {
    const deferred = defer(props.promise)
    const data = await deferred
    return () => (props.children as (result: unknown) => Vue.VNode)(data)
  },
})
