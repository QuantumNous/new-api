'use client'
import * as React from 'react'

// Safe version of React.use() that will not cause compilation errors against
// React 18 with Webpack, which statically analyzes imports and fails when it
// sees React.use referenced (since 'use' is not exported from React 18).
// This uses a dynamic string lookup to avoid the static analysis.
// eslint-disable-next-line prefer-const -- Must be `let` to prevent bundler constant-folding
let REACT_USE = 'use'

/**
 * React.use if available (React 19+), undefined otherwise.
 * Use dynamic lookup to avoid Webpack compilation errors with React 18.
 */
export const reactUse:
  | (<T>(usable: Promise<T> | React.Context<T>) => T)
  | undefined = (React as any)[REACT_USE]

export function useStableCallback<T extends (...args: Array<any>) => any>(
  fn: T,
): T {
  const fnRef = React.useRef(fn)
  fnRef.current = fn

  const ref = React.useRef((...args: Array<any>) => fnRef.current(...args))
  return ref.current as T
}

export const useLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

/**
 * Taken from https://www.developerway.com/posts/implementing-advanced-use-previous-hook#part3
 */
export function usePrevious<T>(value: T): T | null {
  // initialise the ref with previous and current values
  const ref = React.useRef<{ value: T; prev: T | null }>({
    value: value,
    prev: null,
  })

  const current = ref.current.value

  // if the value passed into hook doesn't match what we store as "current"
  // move the "current" to the "previous"
  // and store the passed value as "current"
  if (value !== current) {
    ref.current = {
      value: value,
      prev: current,
    }
  }

  // return the previous value only
  return ref.current.prev
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
  ref: React.RefObject<T | null>,
  callback: (entry: IntersectionObserverEntry | undefined) => void,
  intersectionObserverOptions: IntersectionObserverInit = {},
  options: { disabled?: boolean } = {},
) {
  React.useEffect(() => {
    if (
      !ref.current ||
      options.disabled ||
      typeof IntersectionObserver !== 'function'
    ) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      callback(entry)
    }, intersectionObserverOptions)

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [callback, intersectionObserverOptions, options.disabled, ref])
}

/**
 * React hook to take a `React.ForwardedRef` and returns a `ref` that can be used on a DOM element.
 *
 * @param ref - The forwarded ref
 * @returns The inner ref returned by `useRef`
 * @example
 * ```tsx
 * const MyComponent = React.forwardRef((props, ref) => {
 *  const innerRef = useForwardedRef(ref)
 *  return <div ref={innerRef} />
 * })
 * ```
 */
export function useForwardedRef<T>(ref?: React.ForwardedRef<T>) {
  const innerRef = React.useRef<T>(null)
  React.useImperativeHandle(ref, () => innerRef.current!, [])
  return innerRef
}
