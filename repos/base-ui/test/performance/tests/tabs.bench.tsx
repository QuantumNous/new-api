import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { benchmark } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const tabsRows = createRows(200, 'Tabs');
const tabValues = ['overview', 'details', 'activity'] as const;

function TabsMountList() {
  return (
    <MountList rows={tabsRows}>
      {(row) => (
        <Tabs.Root key={row.id} defaultValue={tabValues[0]}>
          <Tabs.List aria-label={row.label}>
            {tabValues.map((value) => (
              <Tabs.Tab key={value} value={value}>
                {value}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator />
          </Tabs.List>
          {tabValues.map((value) => (
            <Tabs.Panel key={value} value={value}>
              {row.label} {value}
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      )}
    </MountList>
  );
}

benchmark('Tabs mount (200 instances)', () => <TabsMountList />);
