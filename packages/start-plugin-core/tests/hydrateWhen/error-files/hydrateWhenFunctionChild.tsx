import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

export function Page() {
  return <Hydrate when={idle()}>{() => <p>child</p>}</Hydrate>
}
