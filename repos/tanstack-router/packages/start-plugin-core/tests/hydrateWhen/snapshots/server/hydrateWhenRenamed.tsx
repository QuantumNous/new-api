import { Hydrate as HW } from '@tanstack/react-start';
import { interaction } from '@tanstack/react-start/hydration';
function SearchBox() {
  return <input aria-label="Search" />;
}
export function Page() {
  return <HW when={interaction({
    events: 'focusin'
  })} h="0_f555ef3ac2">
      <SearchBox />
    </HW>;
}