import * as React from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { Select } from '@base-ui/react/select';
import styles from './index.module.css';

export default function ExampleToolbar() {
  return (
    <Toolbar.Root className={styles.Toolbar}>
      <ToggleGroup className={styles.Group} aria-label="Alignment">
        <Toolbar.Button
          render={<Toggle />}
          aria-label="Align left"
          value="align-left"
          className={styles.Button}
        >
          Align Left
        </Toolbar.Button>
        <Toolbar.Button
          render={<Toggle />}
          aria-label="Align right"
          value="align-right"
          className={styles.Button}
        >
          Align Right
        </Toolbar.Button>
      </ToggleGroup>
      <Toolbar.Separator className={styles.Separator} />
      <Toolbar.Group className={styles.Group} aria-label="Numerical format">
        <Toolbar.Button className={styles.Button} aria-label="Format as currency">
          $
        </Toolbar.Button>
        <Toolbar.Button className={styles.Button} aria-label="Format as percent">
          %
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator className={styles.Separator} />
      <Select.Root defaultValue="Helvetica">
        <Toolbar.Button render={<Select.Trigger />} className={styles.Button}>
          <Select.Value />
          <Select.Icon>
            <CaretUpDownIcon />
          </Select.Icon>
        </Toolbar.Button>
        <Select.Portal>
          <Select.Positioner className={styles.Positioner} sideOffset={4}>
            <Select.Popup className={styles.Popup}>
              <Select.Item className={styles.Item} value="Helvetica">
                <Select.ItemIndicator className={styles.ItemIndicator}>
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText className={styles.ItemText}>Helvetica</Select.ItemText>
              </Select.Item>
              <Select.Item className={styles.Item} value="Arial">
                <Select.ItemIndicator className={styles.ItemIndicator}>
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText className={styles.ItemText}>Arial</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Toolbar.Separator className={styles.Separator} />
      <Toolbar.Link className={styles.Link} href="#">
        Edited 51m ago
      </Toolbar.Link>
    </Toolbar.Root>
  );
}

function CaretUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
