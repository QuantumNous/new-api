const _H = _lazyRouteComponent(() => import("<fixtureRoot>/hydrateWhenRenamed.tsx?tss-hydrate=0_f555ef3ac2"), "H0");
import { lazyRouteComponent as _lazyRouteComponent } from "@tanstack/react-router";
import { Hydrate as HW } from '@tanstack/react-start';
import { interaction } from '@tanstack/react-start/hydration';
export function Page() {
  return <HW when={interaction({
    events: 'focusin'
  })} h="0_f555ef3ac2">
    {<_H />}
  </HW>;
}