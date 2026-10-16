import * as Vue from 'vue'
import type { ErrorRouteComponent } from './route'

interface ErrorComponentProps {
  error: Error
  reset: () => void
}

type CatchBoundaryProps = {
  getResetKey: () => number | string
  children: Vue.VNode
  errorComponent?: ErrorRouteComponent | Vue.Component
  onCatch?: (error: Error) => void
}

const VueErrorBoundary = Vue.defineComponent({
  name: 'VueErrorBoundary',
  props: {
    onError: Function,
    resetKey: [String, Number],
  },
  emits: ['catch'],
  setup(props, { slots }) {
    const error = Vue.ref<Error | null>(null)
    const resetFn = Vue.ref<(() => void) | null>(null)

    const reset = () => {
      error.value = null
    }

    Vue.watch(
      () => props.resetKey,
      (newKey, oldKey) => {
        if (newKey !== oldKey && error.value) {
          reset()
        }
      },
    )

    Vue.onErrorCaptured((err: Error) => {
      if (
        err instanceof Promise ||
        (err && typeof (err as any).then === 'function')
      ) {
        return false
      }

      error.value = err
      resetFn.value = reset

      if (props.onError) {
        props.onError(err)
      }

      return false
    })

    return () => {
      if (error.value && slots.fallback) {
        const fallbackContent = slots.fallback({
          error: error.value,
          reset,
        })
        return Array.isArray(fallbackContent) && fallbackContent.length === 1
          ? fallbackContent[0]
          : fallbackContent
      }

      const defaultContent = slots.default && slots.default()
      return Array.isArray(defaultContent) && defaultContent.length === 1
        ? defaultContent[0]
        : defaultContent
    }
  },
})

const CatchBoundaryWrapper = Vue.defineComponent({
  name: 'CatchBoundary',
  inheritAttrs: false,
  props: ['getResetKey', 'children', 'errorComponent', 'onCatch'] as any,
  setup(props: CatchBoundaryProps) {
    const resetKey = Vue.computed(() => props.getResetKey())

    return () => {
      return Vue.h(
        VueErrorBoundary,
        {
          resetKey: resetKey.value,
          onError: props.onCatch,
        },
        {
          default: () => props.children,
          fallback: ({ error, reset }: ErrorComponentProps) => {
            if (props.errorComponent) {
              return Vue.h(props.errorComponent, { error, reset })
            }
            return Vue.h(ErrorComponent, { error, reset })
          },
        },
      )
    }
  },
})

export function CatchBoundary(props: CatchBoundaryProps) {
  return Vue.h(CatchBoundaryWrapper, props as any)
}

export const ErrorComponent = Vue.defineComponent({
  name: 'ErrorComponent',
  props: {
    error: Object,
    reset: Function,
  },
  setup(props) {
    const show = Vue.ref(process.env.NODE_ENV !== 'production')

    const toggleShow = () => {
      show.value = !show.value
    }

    return () =>
      Vue.h('div', { style: { padding: '.5rem', maxWidth: '100%' } }, [
        Vue.h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '.5rem' } },
          [
            Vue.h(
              'strong',
              { style: { fontSize: '1rem' } },
              'Something went wrong!',
            ),
            Vue.h(
              'button',
              {
                style: {
                  appearance: 'none',
                  fontSize: '.6em',
                  border: '1px solid currentColor',
                  padding: '.1rem .2rem',
                  fontWeight: 'bold',
                  borderRadius: '.25rem',
                },
                onClick: toggleShow,
              },
              show.value ? 'Hide Error' : 'Show Error',
            ),
          ],
        ),
        Vue.h('div', { style: { height: '.25rem' } }),
        show.value
          ? Vue.h('div', {}, [
              Vue.h(
                'pre',
                {
                  style: {
                    fontSize: '.7em',
                    border: '1px solid red',
                    borderRadius: '.25rem',
                    padding: '.3rem',
                    color: 'red',
                    overflow: 'auto',
                  },
                },
                [
                  props.error?.message
                    ? Vue.h('code', {}, props.error.message)
                    : null,
                ],
              ),
            ])
          : null,
      ])
  },
})
