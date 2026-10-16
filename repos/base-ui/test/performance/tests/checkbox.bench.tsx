import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { benchmark } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const checkboxRows = createRows(500, 'Checkbox');

function CheckboxMountList() {
  return (
    <MountList rows={checkboxRows}>
      {(row) => (
        <Checkbox.Root key={row.id} aria-label={row.label}>
          <Checkbox.Indicator />
        </Checkbox.Root>
      )}
    </MountList>
  );
}

benchmark('Checkbox mount (500 instances)', () => <CheckboxMountList />);
