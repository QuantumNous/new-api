import { Link as Hydrate } from '@tanstack/react-start'

export function Page() {
  return (
    <Hydrate to="/about">
      <p>No transform</p>
    </Hydrate>
  )
}
