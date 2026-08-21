'use client';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './index.module.css';

const ITEMS = [
  { href: '/react/overview', label: 'Overview' },
  { href: '/react/components', label: 'Components' },
  { href: '/react/utils', label: 'Utilities' },
  { href: '/react/overview/releases', label: 'Releases' },
] as const;

const LONG_LIST = [
  { href: '/react/components/accordion', label: 'Accordion' },
  { href: '/react/components/alert-dialog', label: 'Alert Dialog' },
  { href: '/react/components/autocomplete', label: 'Autocomplete' },
  { href: '/react/components/avatar', label: 'Avatar' },
  { href: '/react/components/button', label: 'Button' },
  { href: '/react/components/checkbox', label: 'Checkbox' },
  { href: '/react/components/checkbox-group', label: 'Checkbox Group' },
  { href: '/react/components/collapsible', label: 'Collapsible' },
  { href: '/react/components/combobox', label: 'Combobox' },
  { href: '/react/components/context-menu', label: 'Context Menu' },
  { href: '/react/components/dialog', label: 'Dialog' },
  { href: '/react/components/drawer', label: 'Drawer' },
  { href: '/react/components/field', label: 'Field' },
  { href: '/react/components/fieldset', label: 'Fieldset' },
  { href: '/react/components/form', label: 'Form' },
  { href: '/react/components/input', label: 'Input' },
  { href: '/react/components/menu', label: 'Menu' },
  { href: '/react/components/menubar', label: 'Menubar' },
  { href: '/react/components/meter', label: 'Meter' },
  { href: '/react/components/navigation-menu', label: 'Navigation Menu' },
  { href: '/react/components/number-field', label: 'Number Field' },
  { href: '/react/components/otp-field', label: 'OTP Field' },
  { href: '/react/components/popover', label: 'Popover' },
  { href: '/react/components/preview-card', label: 'Preview Card' },
  { href: '/react/components/progress', label: 'Progress' },
  { href: '/react/components/radio', label: 'Radio' },
  { href: '/react/components/scroll-area', label: 'Scroll Area' },
  { href: '/react/components/select', label: 'Select' },
  { href: '/react/components/separator', label: 'Separator' },
  { href: '/react/components/slider', label: 'Slider' },
  { href: '/react/components/switch', label: 'Switch' },
  { href: '/react/components/tabs', label: 'Tabs' },
  { href: '/react/components/toast', label: 'Toast' },
  { href: '/react/components/toggle', label: 'Toggle' },
  { href: '/react/components/toggle-group', label: 'Toggle Group' },
  { href: '/react/components/toolbar', label: 'Toolbar' },
  { href: '/react/components/tooltip', label: 'Tooltip' },
] as const;

export default function ExampleDrawerMobileNav() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className={styles.Button}>Open mobile menu</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <ScrollArea.Root style={{ position: undefined }} className={styles.ScrollAreaRoot}>
            <ScrollArea.Viewport className={styles.ScrollAreaViewport}>
              <ScrollArea.Content className={styles.ScrollContent}>
                <Drawer.Popup className={styles.Popup}>
                  <nav aria-label="Navigation" className={styles.Panel}>
                    <div className={styles.Header}>
                      <div aria-hidden className={styles.HeaderSpacer} />
                      <div className={styles.Handle} />
                      <Drawer.Close aria-label="Close menu" className={styles.CloseButton}>
                        <XIcon />
                      </Drawer.Close>
                    </div>

                    <Drawer.Content className={styles.Content}>
                      <Drawer.Title className={styles.Title}>Menu</Drawer.Title>
                      <Drawer.Description className={styles.Description}>
                        Scroll the long list. Flick down from the top to dismiss.
                      </Drawer.Description>

                      <div className={styles.ScrollArea}>
                        <ul className={styles.List}>
                          {ITEMS.map((item) => (
                            <li key={item.label} className={styles.Item}>
                              <a className={styles.Link} href={item.href}>
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>

                        <ul className={styles.LongList} aria-label="Component links">
                          {LONG_LIST.map((item) => (
                            <li key={item.label} className={styles.Item}>
                              <a className={styles.Link} href={item.href}>
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Drawer.Content>
                  </nav>
                </Drawer.Popup>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className={styles.Scrollbar}>
              <ScrollArea.Thumb className={styles.ScrollbarThumb} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function XIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 2.5 11 11m-11 0 11-11" />
    </svg>
  );
}
