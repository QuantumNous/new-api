'use client';

import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Select } from '@base-ui/react/select';
import { Menu } from '@base-ui/react/menu';
import { Drawer } from '@base-ui/react/drawer';
import { Dialog } from '@base-ui/react/dialog';
import { Tooltip } from '@base-ui/react/tooltip';
import styles from './popups-in-popups.module.css';

export default function PopupsInPopups() {
  const [modal, setModal] = React.useState(true);
  const [withBackdrop, setWithBackdrop] = React.useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <label>
        <input
          type="checkbox"
          checked={modal}
          onChange={(event) => setModal(event.target.checked)}
        />{' '}
        Modal
      </label>
      <label>
        <input
          type="checkbox"
          checked={withBackdrop}
          onChange={() => setWithBackdrop(!withBackdrop)}
        />{' '}
        With backdrop
      </label>
      <div className={styles.Launchers}>
        <DialogDemo modal={modal} withBackdrop={withBackdrop} />
      </div>
    </div>
  );
}

function DialogDemo({ modal, withBackdrop }: Props & { withBackdrop: boolean }) {
  return (
    <Dialog.Root modal={modal}>
      <Dialog.Trigger className={styles.Button}>Open dialog</Dialog.Trigger>

      {withBackdrop && <Dialog.Backdrop className={styles.DialogBackdrop} />}

      <Dialog.Portal>
        <Dialog.Popup className={styles.DialogPopup}>
          <Dialog.Title className={styles.DialogTitle}>Popup playground</Dialog.Title>
          <Dialog.Description className={styles.DialogDescription}>
            Test dialog, drawer, and nested portaled popups with the same hero-demo styling as the
            public docs.
          </Dialog.Description>
          <PopupDemoContent
            modal={modal}
            withBackdrop={withBackdrop}
            closeButton={<Dialog.Close className={styles.Button}>Cancel</Dialog.Close>}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NestedDrawerDemo({ modal, withBackdrop }: Props & { withBackdrop: boolean }) {
  return (
    <Drawer.Root modal={modal} swipeDirection="down">
      <Drawer.Trigger className={styles.Button}>Open drawer</Drawer.Trigger>

      <Drawer.Portal>
        {withBackdrop ? <Drawer.Backdrop className={styles.DrawerBackdrop} /> : null}
        <Drawer.Viewport className={styles.DrawerViewport}>
          <Drawer.Popup className={styles.DrawerPopup}>
            <div className={styles.DrawerHandle} />
            <Drawer.Content className={styles.DrawerContent}>
              <Drawer.Title className={styles.DrawerTitle}>Nested drawer</Drawer.Title>
              <Drawer.Description className={styles.DrawerDescription}>
                This drawer sits inside the dialog so you can test portaled popups in both layers.
              </Drawer.Description>
              <PopupDemoContent
                modal={modal}
                withBackdrop={withBackdrop}
                closeButton={<Drawer.Close className={styles.Button}>Close</Drawer.Close>}
                controlsClassName={styles.DrawerControls}
              />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PopupDemoContent({
  modal,
  withBackdrop,
  closeButton,
  controlsClassName = styles.DialogControls,
}: Props & {
  withBackdrop: boolean;
  closeButton: React.ReactNode;
  controlsClassName?: string;
}) {
  return (
    <React.Fragment>
      <div className={styles.PopupGrid}>
        <SelectDemo modal={modal} />
        <MenuDemo modal={modal} />
        <ExampleCombobox />
      </div>
      <div className={styles.NestedTriggerRow}>
        <NestedDrawerDemo modal={modal} withBackdrop={withBackdrop} />
      </div>
      <div className={controlsClassName}>{closeButton}</div>
    </React.Fragment>
  );
}

function SelectDemo({ modal }: Props) {
  return (
    <div className={styles.Field}>
      <Select.Root modal={modal} defaultValue={fontOptions[0].value} items={fontOptions}>
        <Select.Label className={styles.Label}>Font</Select.Label>
        <Tooltip.Root>
          <Select.Trigger render={<Tooltip.Trigger className={styles.Select} />} nativeButton>
            <Select.Value className={styles.Value} placeholder="Select font" />
            <Select.Icon className={styles.SelectIcon}>
              <ChevronUpDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={10}>
              <Tooltip.Popup className={styles.TooltipPopup}>Choose a font</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Select.Portal>
          <Select.Positioner
            sideOffset={8}
            className={styles.SelectPositioner}
            alignItemWithTrigger={false}
          >
            <Select.Popup className={styles.SelectPopup}>
              <Select.ScrollUpArrow className={styles.SelectScrollArrow} />
              <Select.List className={styles.SelectList}>
                {fontOptions.map((option) => (
                  <Select.Item
                    key={option.value}
                    className={styles.SelectItem}
                    value={option.value}
                  >
                    <Select.ItemIndicator className={styles.SelectItemIndicator}>
                      <CheckIcon className={styles.SelectItemIndicatorIcon} />
                    </Select.ItemIndicator>
                    <Select.ItemText className={styles.SelectItemText}>
                      {option.label}
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
              <Select.ScrollDownArrow className={styles.SelectScrollArrow} />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

const createHandleMenuClick = (menuItem: string) => {
  return () => {
    console.log(`Clicked on ${menuItem}`);
  };
};

function MenuDemo({ modal }: Props) {
  return (
    <Menu.Root modal={modal}>
      <Menu.Trigger className={styles.Button}>
        Format <ChevronDownIcon className={styles.ButtonIcon} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className={styles.MenuPositioner}
        >
          <Menu.Popup className={styles.MenuPopup}>
            <Menu.Arrow className={styles.MenuArrow}>
              <ArrowSvg />
            </Menu.Arrow>
            <Menu.SubmenuRoot closeParentOnEsc={false}>
              <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                Text color
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner
                  align="start"
                  side="right"
                  sideOffset={12}
                  className={styles.MenuPositioner}
                >
                  <Menu.Popup className={styles.MenuPopup}>
                    {textColors.map((color) => (
                      <Menu.Item
                        key={color}
                        className={styles.MenuItem}
                        onClick={createHandleMenuClick(`Text color/${color}`)}
                      >
                        {color}
                      </Menu.Item>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>Style</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner
                  align="start"
                  side="right"
                  sideOffset={12}
                  className={styles.MenuPositioner}
                >
                  <Menu.Popup className={styles.MenuPopup}>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                        Heading
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner
                          align="start"
                          side="right"
                          sideOffset={12}
                          className={styles.MenuPositioner}
                        >
                          <Menu.Popup className={styles.MenuPopup}>
                            {headingLevels.map((level) => (
                              <Menu.Item
                                key={level}
                                className={styles.MenuItem}
                                onClick={createHandleMenuClick(`Style/Heading/${level}`)}
                              >
                                {level}
                              </Menu.Item>
                            ))}
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    {styleItems.map((item) => (
                      <Menu.Item
                        key={item}
                        className={styles.MenuItem}
                        onClick={createHandleMenuClick(`Style/${item}`)}
                      >
                        {item}
                      </Menu.Item>
                    ))}
                    <Menu.Item className={styles.MenuItem} disabled>
                      List
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            {rootMenuItems.map((item) => (
              <Menu.Item
                key={item}
                className={styles.MenuItem}
                onClick={createHandleMenuClick(item)}
              >
                {item}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

interface Props {
  modal: boolean;
}

function ExampleCombobox() {
  const id = React.useId();
  return (
    <Combobox.Root items={fruits}>
      <div className={styles.ComboboxLabel}>
        <label htmlFor={id}>Choose a fruit</label>
        <Combobox.InputGroup className={styles.ComboboxInputGroup}>
          <Combobox.Input placeholder="e.g. Apple" id={id} className={styles.ComboboxInput} />
          <div className={styles.ComboboxActionButtons}>
            <Combobox.Clear className={styles.ComboboxClear} aria-label="Clear selection">
              <ClearIcon className={styles.ComboboxClearIcon} />
            </Combobox.Clear>
            <Combobox.Trigger className={styles.ComboboxTrigger} aria-label="Open popup">
              <ChevronDownIcon className={styles.ComboboxTriggerIcon} />
            </Combobox.Trigger>
          </div>
        </Combobox.InputGroup>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner className={styles.ComboboxPositioner} sideOffset={4}>
          <Combobox.Popup className={styles.ComboboxPopup}>
            <Combobox.Empty className={styles.ComboboxEmpty}>No fruits found.</Combobox.Empty>
            <Combobox.List className={styles.ComboboxList}>
              {(item: string) => (
                <Combobox.Item key={item} value={item} className={styles.ComboboxItem}>
                  <Combobox.ItemIndicator className={styles.ComboboxItemIndicator}>
                    <CheckIcon className={styles.ComboboxItemIndicatorIcon} />
                  </Combobox.ItemIndicator>
                  <div className={styles.ComboboxItemText}>{item}</div>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function ClearIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

const fruits = [
  'Apple',
  'Banana',
  'Orange',
  'Pineapple',
  'Grape',
  'Mango',
  'Strawberry',
  'Blueberry',
  'Raspberry',
  'Blackberry',
  'Cherry',
  'Peach',
  'Pear',
  'Plum',
  'Kiwi',
  'Watermelon',
  'Cantaloupe',
  'Honeydew',
  'Papaya',
  'Guava',
  'Lychee',
  'Pomegranate',
  'Apricot',
  'Grapefruit',
  'Passionfruit',
];

const fontOptions = [
  { value: 'system', label: 'System font' },
  { value: 'arial', label: 'Arial' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'times', label: 'Times New Roman' },
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'verdana', label: 'Verdana' },
  { value: 'tahoma', label: 'Tahoma' },
  { value: 'garamond', label: 'Garamond' },
  { value: 'futura', label: 'Futura' },
  { value: 'avenir', label: 'Avenir' },
  { value: 'courier', label: 'Courier New' },
  { value: 'monaco', label: 'Monaco' },
  { value: 'inter', label: 'Inter' },
  { value: 'plex', label: 'IBM Plex Sans' },
];

const textColors = [
  'Black',
  'Dark grey',
  'Slate',
  'Navy',
  'Indigo',
  'Blue',
  'Cyan',
  'Teal',
  'Green',
  'Lime',
  'Olive',
  'Gold',
  'Orange',
  'Coral',
  'Red',
  'Magenta',
  'Purple',
  'Brown',
];

const headingLevels = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Display',
  'Eyebrow',
];

const styleItems = [
  'Paragraph',
  'Lead paragraph',
  'Quote',
  'Callout',
  'Code block',
  'Caption',
  'Pull quote',
  'Divider',
];

const rootMenuItems = [
  'Clear formatting',
  'Duplicate block',
  'Turn into note',
  'Turn into to-do',
  'Pin section',
  'Lock section',
  'Export snippet',
  'Archive block',
];
