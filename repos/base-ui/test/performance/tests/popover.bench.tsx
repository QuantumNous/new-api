import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { benchmark } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const popoverRows = createRows(300, 'Popover');

function PopoverMountList() {
  return (
    <MountList rows={popoverRows}>
      {(row) => (
        <Popover.Root key={row.id}>
          <Popover.Trigger aria-label={`Open ${row.label}`}>{row.label}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8}>
              <Popover.Popup>
                <Popover.Title>{row.label}</Popover.Title>
                <Popover.Description>Popover content</Popover.Description>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </MountList>
  );
}

benchmark('Popover mount (300 instances)', () => <PopoverMountList />);
