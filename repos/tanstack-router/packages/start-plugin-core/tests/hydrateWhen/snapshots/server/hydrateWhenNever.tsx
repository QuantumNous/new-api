import { Hydrate } from '@tanstack/react-start';
import { never } from '@tanstack/react-start/hydration';
function StaticMarketingBlock() {
  return <section>Static marketing</section>;
}
export function Page() {
  return <Hydrate when={never()} h="0_b752509d76">
      <StaticMarketingBlock />
    </Hydrate>;
}