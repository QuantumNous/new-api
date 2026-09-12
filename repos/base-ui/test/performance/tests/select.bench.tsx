import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { benchmark, ElementTiming } from '@mui/internal-benchmark';
import { createRows, MountList } from './shared';

const selectRows = createRows(200, 'Select');
const selectItems = createRows(5, 'Option');
const largeSelectItems = createRows(500, 'Option');

function SelectMountList() {
  return (
    <MountList rows={selectRows}>
      {(row) => (
        <Select.Root key={row.id} items={selectItems}>
          <Select.Trigger aria-label={`Open ${row.label}`}>
            <Select.Value placeholder={row.label} />
            <Select.Icon>v</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={8}>
              <Select.Popup>
                <Select.List>
                  {selectItems.map((item) => (
                    <Select.Item key={item.id} value={item.value}>
                      <Select.ItemIndicator />
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      )}
    </MountList>
  );
}

function LargeSelect() {
  return (
    <Select.Root items={largeSelectItems}>
      <Select.Trigger aria-label="Open select benchmark">
        <Select.Value placeholder="Choose option" />
        <Select.Icon>v</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={8}>
          <Select.Popup>
            <div data-benchmark="select-open-content">
              <ElementTiming name="select-open" />
            </div>
            <Select.List>
              {largeSelectItems.map((item) => (
                <Select.Item key={item.id} value={item.value}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

benchmark('Select mount (200 instances)', () => <SelectMountList />);

benchmark(
  'Select open (500 options)',
  () => <LargeSelect />,
  async ({ waitForElementTiming }) => {
    const trigger = document.querySelector<HTMLElement>('[aria-label="Open select benchmark"]');

    if (trigger == null) {
      throw new Error('Missing select benchmark trigger');
    }

    trigger.click();
    await waitForElementTiming('select-open');

    if (document.querySelector('[data-benchmark="select-open-content"]') == null) {
      throw new Error('Select benchmark popup did not open');
    }
  },
);
