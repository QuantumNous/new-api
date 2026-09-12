import * as Vue from 'vue'

export const useLayoutEffect =
  typeof window !== 'undefined' ? Vue.effect : Vue.effect

export const usePrevious = (fn: () => boolean) => {
  return Vue.computed(
    (
      prev: { current: boolean | null; previous: boolean | null } = {
        current: null,
        previous: null,
      },
    ) => {
      const current = fn()

      if (prev.current !== current) {
        prev.previous = prev.current
        prev.current = current
      }

      return prev
    },
  )
}

/**
 * React hook to wrap `IntersectionObserver`.
 *
 * This hook will create an `IntersectionObserver` and observe the ref passed to it.
 *
 * When the intersection changes, the callback will be called with the `IntersectionObserverEntry`.
 *
 * @param ref - The ref to observe
 * @param intersectionObserverOptions - The options to pass to the IntersectionObserver
 * @param options - The options to pass to the hook
 * @param callback - The callback to call when the intersection changes
 * @returns The IntersectionObserver instance
 * @example
 * ```tsx
 * const MyComponent = () => {
 * const ref = React.useRef<HTMLDivElement>(null)
 * useIntersectionObserver(
 *  ref,
 *  (entry) => { doSomething(entry) },
 *  { rootMargin: '10px' },
 *  { disabled: false }
 * )
 * return <div ref={ref} />
 * ```
 */
export function useIntersectionObserver<T extends Element>(
  ref: Vue.Ref<T | null>,
  callback: (entry: IntersectionObserverEntry | undefined) => void,
  intersectionObserverOptions: IntersectionObserverInit = {},
  options: { disabled?: boolean | (() => boolean) } = {},
): Vue.Ref<IntersectionObserver | null> {
  const isIntersectionObserverAvailable =
    typeof IntersectionObserver === 'function'
  const observerRef = Vue.ref<IntersectionObserver | null>(null)

  // Use watchEffect with cleanup to properly manage the observer lifecycle
  Vue.watchEffect((onCleanup) => {
    const r = ref.value
    // Support both static boolean and function for disabled check
    const isDisabled =
      typeof options.disabled === 'function'
        ? options.disabled()
        : options.disabled
    if (!r || !isIntersectionObserverAvailable || isDisabled) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      callback(entry)
    }, intersectionObserverOptions)

    observerRef.value = observer
    observer.observe(r)

    onCleanup(() => {
      observer.disconnect()
      observerRef.value = null
    })
  })

  return observerRef
}

export function splitProps<T extends Record<string, any>>(
  props: T,
  keys: Array<keyof T>,
) {
  // Get the specified props
  const selectedProps = Vue.computed(() => {
    return Object.fromEntries(keys.map((key) => [key, props[key]]))
  })

  // Get remaining props as attrs
  const remainingAttrs = Vue.computed(() => {
    const attrs = Vue.useAttrs()
    return Object.fromEntries(
      Object.entries(attrs).filter(([key]) => !keys.includes(key as keyof T)),
    )
  })

  return [selectedProps, remainingAttrs]
}

export type ParentProps<T = {}> = T & {
  children?: Vue.VNode | Array<Vue.VNode> | string
}
