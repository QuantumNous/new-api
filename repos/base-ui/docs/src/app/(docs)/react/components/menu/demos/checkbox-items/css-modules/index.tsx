'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from './index.module.css';

export default function ExampleMenu() {
  const [showMinimap, setShowMinimap] = React.useState(true);
  const [showSearch, setShowSearch] = React.useState(true);
  const [showSidebar, setShowSidebar] = React.useState(false);

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.Button}>
        Workspace <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.Positioner} sideOffset={8}>
          <Menu.Popup className={styles.Popup}>
            <Menu.CheckboxItem
              checked={showMinimap}
              onCheckedChange={setShowMinimap}
              className={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator className={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span className={styles.CheckboxItemText}>Minimap</span>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={showSearch}
              onCheckedChange={setShowSearch}
              className={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator className={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span className={styles.CheckboxItemText}>Search</span>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={showSidebar}
              onCheckedChange={setShowSidebar}
              className={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator className={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span className={styles.CheckboxItemText}>Sidebar</span>
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function CaretDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
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
