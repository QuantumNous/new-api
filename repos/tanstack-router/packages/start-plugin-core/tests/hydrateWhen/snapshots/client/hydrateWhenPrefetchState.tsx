const _H = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenPrefetchState.tsx?tss-hydrate=0_24b5f958eb"), "H0"),
  _H0_preload = _H.preload;
import { lazyRouteComponent as _lazyRouteComponent } from "@tanstack/react-router";
import { useState } from 'react';
import { Hydrate } from '@tanstack/react-start';
import { interaction } from '@tanstack/react-start/hydration';
export function Page() {
  const [status, setStatus] = useState('idle');
  const [, setUnusedStatus] = useState('idle');
  return <section>
      <p>{status}</p>
      <Hydrate when={interaction()} prefetch={async () => {
      setStatus('prefetched');
      setUnusedStatus('prefetched');
    }} h="0_24b5f958eb" p={_H0_preload}>
      {<_H />}
    </Hydrate>
    </section>;
}