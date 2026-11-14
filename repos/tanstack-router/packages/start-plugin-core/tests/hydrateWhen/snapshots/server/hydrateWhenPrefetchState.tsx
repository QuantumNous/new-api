import { useState } from 'react';
import { Hydrate } from '@tanstack/react-start';
import { interaction } from '@tanstack/react-start/hydration';
function Widget() {
  return <button>Widget</button>;
}
export function Page() {
  const [status, setStatus] = useState('idle');
  const [, setUnusedStatus] = useState('idle');
  return <section>
      <p>{status}</p>
      <Hydrate when={interaction()} prefetch={async () => {
      setStatus('prefetched');
      setUnusedStatus('prefetched');
    }} h="0_24b5f958eb">
        <Widget />
      </Hydrate>
    </section>;
}