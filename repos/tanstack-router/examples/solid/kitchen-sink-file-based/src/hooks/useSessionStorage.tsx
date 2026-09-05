import * as Solid from 'solid-js'

export function useSessionStorage<T>(key: string, initialValue: any) {
  const [state, setState] = Solid.createSignal<T>(
    (() => {
      const stored = sessionStorage.getItem(key)
      console.log('stored', key, stored, initialValue, typeof stored)
      const reutrnval =
        stored && stored !== 'undefined' ? JSON.parse(stored) : initialValue
      console.log('returning', reutrnval)
      return reutrnval
    })(),
  )

  Solid.createEffect(() => {
    console.log('setting', JSON.stringify(state()))
    sessionStorage.setItem(key, JSON.stringify(state()))
  })

  return [state, setState]
}
