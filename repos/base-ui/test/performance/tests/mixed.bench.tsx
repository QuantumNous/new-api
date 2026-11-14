import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { Select } from '@base-ui/react/select';
import { Slider } from '@base-ui/react/slider';
import { Tabs } from '@base-ui/react/tabs';
import { Tooltip } from '@base-ui/react/tooltip';
import { benchmark } from '@mui/internal-benchmark';
import { createRows } from './shared';

const tooltipRows = createRows(200, 'Tooltip');
const checkboxRows = createRows(40, 'Checkbox');
const menuRows = createRows(24, 'Menu');
const popoverRows = createRows(16, 'Popover');
const selectRows = createRows(12, 'Select');
const dialogRows = createRows(8, 'Dialog');
const tabsRows = createRows(8, 'Tabs');
const sliderRows = createRows(12, 'Slider');
const scrollAreaRows = createRows(10, 'Scroll area');
const listItems = createRows(5, 'Option');
const tabValues = ['overview', 'details', 'activity'] as const;

function MixedSurface() {
  return (
    <div>
      <section>
        {tooltipRows.map((row) => (
          <Tooltip.Root key={`tooltip-${row.id}`}>
            <Tooltip.Trigger delay={0} aria-label={`Open tooltip ${row.id}`}>
              {row.label}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup>Tooltip for {row.label}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </section>

      <section>
        {menuRows.map((row) => (
          <Menu.Root key={`menu-${row.id}`}>
            <Menu.Trigger aria-label={`Open menu ${row.id}`}>{row.label}</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8}>
                <Menu.Popup>
                  {listItems.map((item) => (
                    <Menu.Item key={item.id}>{item.label}</Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ))}

        {popoverRows.map((row) => (
          <Popover.Root key={`popover-${row.id}`}>
            <Popover.Trigger aria-label={`Open popover ${row.id}`}>{row.label}</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={8}>
                <Popover.Popup>
                  <Popover.Title>{row.label}</Popover.Title>
                  <Popover.Description>Popover content</Popover.Description>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        ))}

        {selectRows.map((row) => (
          <Select.Root key={`select-${row.id}`} items={listItems}>
            <Select.Trigger aria-label={`Open select ${row.id}`}>
              <Select.Value placeholder={row.label} />
              <Select.Icon>v</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={8}>
                <Select.Popup>
                  <Select.List>
                    {listItems.map((item) => (
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
        ))}

        {dialogRows.map((row) => (
          <Dialog.Root key={`dialog-${row.id}`}>
            <Dialog.Trigger aria-label={`Open dialog ${row.id}`}>{row.label}</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup>
                <Dialog.Title>{row.label}</Dialog.Title>
                <Dialog.Description>Dialog content</Dialog.Description>
                <Dialog.Close>Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ))}
      </section>

      <section>
        {tabsRows.map((row) => (
          <Tabs.Root key={`tabs-${row.id}`} defaultValue={tabValues[0]}>
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
        ))}

        {sliderRows.map((row) => (
          <Slider.Root key={`slider-${row.id}`} defaultValue={50}>
            <Slider.Value />
            <Slider.Control aria-label={row.label}>
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        ))}

        {scrollAreaRows.map((row) => (
          <ScrollArea.Root
            key={`scroll-area-${row.id}`}
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
        ))}

        {checkboxRows.map((row) => (
          <Checkbox.Root key={`checkbox-${row.id}`} aria-label={row.label}>
            <Checkbox.Indicator />
          </Checkbox.Root>
        ))}
      </section>
    </div>
  );
}

benchmark('Mixed surface mount (app-like density)', () => <MixedSurface />);
