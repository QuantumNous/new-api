import * as Solid from 'solid-js'

export function useSessionStorage<T>(key: string, initialValue: T) {
  const stored = sessionStorage.getItem(key)
  const [state, setState] = Solid.createSignal<T>(
    stored ? JSON.parse(stored) : initialValue,
  )

  Solid.createEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state()))
  }, [state()])

  return [state, setState]
}
