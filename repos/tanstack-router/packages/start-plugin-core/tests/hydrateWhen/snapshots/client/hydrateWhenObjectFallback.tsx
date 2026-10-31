const _H3 = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenObjectFallback.tsx?tss-hydrate=2_7f4dc3aa80"), "H2");
const _H2 = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenObjectFallback.tsx?tss-hydrate=1_7f4dc3aa80"), "H1");
const _H = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenObjectFallback.tsx?tss-hydrate=0_7f4dc3aa80"), "H0");
import { lazyRouteComponent as _lazyRouteComponent } from "@tanstack/react-router";
import { Hydrate } from '@tanstack/react-start';
import { idle, visible } from '@tanstack/react-start/hydration';
const spreadProps = {
  when: visible(),
  fallback: <div data-testid="bound-spread-fallback">Bound</div>
};
export function Page() {
  return <>
      <Hydrate when={visible()} fallback={<div data-testid="direct-fallback">Direct</div>} h="0_7f4dc3aa80">
      {<_H />}
    </Hydrate>
      <Hydrate {...{
      when: idle(),
      fallback: <div data-testid="inline-spread-fallback">Inline</div>
    }} h="1_7f4dc3aa80">
      {<_H2 />}
    </Hydrate>
      <Hydrate {...spreadProps} h="2_7f4dc3aa80">
      {<_H3 />}
    </Hydrate>
    </>;
}