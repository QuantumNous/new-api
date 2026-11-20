import * as Vue from 'vue'

export interface ClientOnlyProps {
  /**
   * The children to render when the JS is loaded.
   */
  children?: Vue.VNode
  /**
   * The fallback component to render if the JS is not yet loaded.
   */
  fallback?: Vue.VNode
}

/**
 * Render the children only after the JS has loaded client-side. Use an optional
 * fallback component if the JS is not yet loaded.
 *
 * @example
 * Render a Chart component if JS loads, renders a simple FakeChart
 * component server-side or if there is no JS. The FakeChart can have only the
 * UI without the behavior or be a loading spinner or skeleton.
 *
 * ```tsx
 * return (
 *   <ClientOnly fallback={<FakeChart />}>
 *     <Chart />
 *   </ClientOnly>
 * )
 * ```
 */
export const ClientOnly = Vue.defineComponent({
  name: 'ClientOnly',
  props: {
    fallback: {
      type: Object as Vue.PropType<Vue.VNode>,
      default: null,
    },
  },
  setup(props, { slots }) {
    const hydrated = useHydrated()
    return () => {
      if (hydrated.value) {
        return slots.default?.()
      }
      return props.fallback ?? null
    }
  },
})

/**
 * Return a boolean indicating if the JS has been hydrated already.
 * When doing Server-Side Rendering, the result will always be false.
 * When doing Client-Side Rendering, the result will always be false on the
 * first render and true from then on. Even if a new component renders it will
 * always start with true.
 *
 * @example
 * ```tsx
 * // Disable a button that needs JS to work.
 * const hydrated = useHydrated()
 * return (
 *   <button type="button" disabled={!hydrated.value} onClick={doSomethingCustom}>
 *     Click me
 *   </button>
 * )
 * ```
 * @returns True if the JS has been hydrated already, false otherwise.
 */
export function useHydrated(): Vue.Ref<boolean> {
  const hydrated = Vue.ref(false)
  Vue.onMounted(() => {
    hydrated.value = true
  })
  return hydrated
}
