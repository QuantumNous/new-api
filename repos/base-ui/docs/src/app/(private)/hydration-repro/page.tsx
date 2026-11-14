'use client';

import { ScrollArea } from '@base-ui/react/scroll-area';
import { Tabs } from '@base-ui/react/tabs';

import './index.css';

const VIEWPORT_SIZE = 200;
const SCROLLABLE_CONTENT_SIZE = 1000;

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <Tabs.Root defaultValue="scrollable">
        <Tabs.List style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Tabs.Tab value="scrollable">Scrollable</Tabs.Tab>
          <Tabs.Tab value="other">Other</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="scrollable">
          <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
            <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
              <ScrollArea.Content>
                <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" keepMounted>
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Tabs.Panel>

        <Tabs.Panel value="other">
          <div>Other panel</div>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
