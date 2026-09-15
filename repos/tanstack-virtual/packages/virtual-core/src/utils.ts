export type NoInfer<A extends any> = [A][A extends any ? 0 : never]

export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export function memo<TDeps extends ReadonlyArray<any>, TResult>(
  getDeps: () => [...TDeps],
  fn: (...args: NoInfer<[...TDeps]>) => TResult,
  opts: {
    key: false | string
    debug?: () => boolean
    onChange?: (result: TResult) => void
    initialDeps?: TDeps
    skipInitialOnChange?: boolean
  },
) {
  let deps = opts.initialDeps ?? []
  let result: TResult | undefined
  let isInitial = true

  function memoizedFunction(): TResult {
    // Debug-only timing. In production builds, `process.env.NODE_ENV !==
    // 'production'` is constant-folded to `false` by downstream minifiers
    // (Terser/esbuild/swc with `define`), which DCEs the entire block.
    const debugEnabled =
      process.env.NODE_ENV !== 'production' && !!opts.key && !!opts.debug?.()
    let depTime = 0
    if (debugEnabled) depTime = Date.now()

    const newDeps = getDeps()

    const depsChanged =
      newDeps.length !== deps.length ||
      newDeps.some((dep: any, index: number) => deps[index] !== dep)

    if (!depsChanged) {
      return result!
    }

    deps = newDeps

    let resultTime = 0
    if (debugEnabled) resultTime = Date.now()

    result = fn(...newDeps)

    if (debugEnabled) {
      const depEndTime = Math.round((Date.now() - depTime) * 100) / 100
      const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100
      const resultFpsPercentage = resultEndTime / 16

      const pad = (str: number | string, num: number) => {
        str = String(str)
        while (str.length < num) {
          str = ' ' + str
        }
        return str
      }

      console.info(
        `%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`,
        `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(
              0,
              Math.min(120 - 120 * resultFpsPercentage, 120),
            )}deg 100% 31%);`,
        opts?.key,
      )
    }

    if (opts?.onChange && !(isInitial && opts.skipInitialOnChange)) {
      opts.onChange(result)
    }

    isInitial = false

    return result
  }

  // Attach updateDeps to the function itself
  memoizedFunction.updateDeps = (newDeps: [...TDeps]) => {
    deps = newDeps
  }

  return memoizedFunction
}

export function notUndefined<T>(value: T | undefined, msg?: string): T {
  if (value === undefined) {
    throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ''}`)
  } else {
    return value
  }
}

export const approxEqual = (a: number, b: number) => Math.abs(a - b) < 1.01

export const debounce = (
  targetWindow: Window & typeof globalThis,
  fn: Function,
  ms: number,
) => {
  let timeoutId: number
  return function (this: any, ...args: Array<any>) {
    targetWindow.clearTimeout(timeoutId)
    timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms)
  }
}
