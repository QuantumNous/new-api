import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { benchmark } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const dialogRows = createRows(300, 'Dialog');

function DialogMountList() {
  return (
    <MountList rows={dialogRows}>
      {(row) => (
        <Dialog.Root key={row.id}>
          <Dialog.Trigger aria-label={`Open ${row.label}`}>{row.label}</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Dialog.Title>{row.label}</Dialog.Title>
              <Dialog.Description>Dialog content</Dialog.Description>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </MountList>
  );
}

benchmark('Dialog mount (300 instances)', () => <DialogMountList />);
