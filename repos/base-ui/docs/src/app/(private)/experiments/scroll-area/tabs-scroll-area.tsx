'use client';
import * as React from 'react';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { Tabs } from '@base-ui/react/tabs';

const ITEMS = Array.from({ length: 32 }, (_, i) => `Item ${i + 1}`);

export default function ScrollAreaTabsScrollArea() {
  const [keepMounted, setKeepMounted] = React.useState(false);

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 12,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={keepMounted}
          onChange={(event) => setKeepMounted(event.target.checked)}
        />
        keepMounted on Scrollable panel
      </label>

      <p style={{ margin: 0 }}>
        Repro flow: switch to <strong>Other</strong>, then back to <strong>Scrollable</strong>.
      </p>

      <Tabs.Root
        defaultValue="scrollable"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        <Tabs.List style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <Tabs.Tab value="scrollable">Scrollable</Tabs.Tab>
          <Tabs.Tab value="other">Other</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel
          value="scrollable"
          keepMounted={keepMounted}
          style={{ display: 'flex', flex: 1, minHeight: 0 }}
        >
          <ScrollArea.Root
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <ScrollArea.Viewport style={{ maxHeight: '100%' }}>
              <ScrollArea.Content>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {ITEMS.map((item) => (
                    <li
                      key={item}
                      style={{
                        padding: 12,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {item} - filler text
                    </li>
                  ))}
                </ul>
              </ScrollArea.Content>
            </ScrollArea.Viewport>

            <ScrollArea.Scrollbar
              orientation="vertical"
              style={{
                display: 'flex',
                width: 16,
                background: '#ddd',
              }}
            >
              <ScrollArea.Thumb
                style={{
                  background: '#888',
                  width: '100%',
                  padding: 2,
                }}
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Tabs.Panel>

        <Tabs.Panel value="other" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>Now switch back to Scrollable.</p>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
