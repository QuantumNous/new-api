import { Hydrate } from '@tanstack/react-start'
import { never } from '@tanstack/react-start/hydration'

function StaticMarketingBlock() {
  return <section>Static marketing</section>
}

export function Page() {
  return (
    <Hydrate when={never()}>
      <StaticMarketingBlock />
    </Hydrate>
  )
}
