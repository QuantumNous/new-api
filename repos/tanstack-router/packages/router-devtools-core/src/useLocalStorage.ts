import { createEffect, createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

const getItem = (key: string): unknown => {
  try {
    const itemValue = localStorage.getItem(key)
    if (typeof itemValue === 'string') {
      return JSON.parse(itemValue)
    }
    return undefined
  } catch {
    return undefined
  }
}

export default function useLocalStorage<T>(
  key: string,
  defaultValue: T | undefined,
): [Accessor<T | undefined>, (newVal: T | ((prevVal: T) => T)) => void] {
  const [value, setValue] = createSignal<T>()

  createEffect(() => {
    const initialValue = getItem(key) as T | undefined

    if (typeof initialValue === 'undefined' || initialValue === null) {
      setValue(
        typeof defaultValue === 'function' ? defaultValue() : defaultValue,
      )
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      setValue(initialValue)
    }
  })

  const setter = (updater: any) => {
    setValue((old) => {
      let newVal = updater

      if (typeof updater == 'function') {
        newVal = updater(old)
      }
      try {
        localStorage.setItem(key, JSON.stringify(newVal))
      } catch {}

      return newVal
    })
  }

  return [value, setter]
}
