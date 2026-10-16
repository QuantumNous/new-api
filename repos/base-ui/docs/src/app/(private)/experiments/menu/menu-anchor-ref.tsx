'use client';

import * as React from 'react';
import { Menu } from '@base-ui/react/menu';

export default function Page() {
  const anchor = React.useRef<HTMLDivElement>(null);

  return (
    <div>
      <h1>Ref passed to anchor</h1>
      <Menu.Root>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" arrowPadding={0} anchor={anchor}>
            <Menu.Popup>
              <Menu.Item style={{ background: 'lightgray', padding: '5px' }}>One</Menu.Item>
              <Menu.Item style={{ background: 'lightgray', padding: '5px' }}>Two</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <div
        data-testid="anchor"
        style={{
          margin: '100px',
          background: 'yellowgreen',
          height: '50px',
          width: '200px',
        }}
        ref={anchor}
      >
        Anchor
      </div>
    </div>
  );
}
