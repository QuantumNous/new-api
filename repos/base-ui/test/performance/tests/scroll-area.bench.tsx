import * as React from 'react';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { benchmark } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const scrollAreaRows = createRows(300, 'Scroll area');

function ScrollAreaMountList() {
  return (
    <MountList rows={scrollAreaRows}>
      {(row) => (
        <ScrollArea.Root
          key={row.id}
          style={{ width: 120, height: 120, overflow: 'hidden', position: 'relative' }}
        >
          <ScrollArea.Viewport>
            <ScrollArea.Content>
              <div style={{ width: 240, height: 240 }}>{row.label}</div>
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      )}
    </MountList>
  );
}

benchmark('Scroll Area mount (300 instances)', () => <ScrollAreaMountList />);
