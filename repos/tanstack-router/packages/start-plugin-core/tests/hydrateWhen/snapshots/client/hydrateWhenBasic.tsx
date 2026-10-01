const _H = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenBasic.tsx?tss-hydrate=0_3cf0187f82"), "H0"),
  _H0_preload = _H.preload;
import { lazyRouteComponent as _lazyRouteComponent } from "@tanstack/react-router";
import { Hydrate } from '@tanstack/react-start';
import { idle, visible } from '@tanstack/react-start/hydration';
import { FallbackPane } from './widgets';
export function Page() {
  return <section>
      <Hydrate when={visible({
      rootMargin: '200px',
      threshold: 0.25
    })} prefetch={idle({
      timeout: 100
    })} fallback={<FallbackPane label="chart" />} h="0_3cf0187f82" p={_H0_preload}>
      {<_H />}
    </Hydrate>
    </section>;
}