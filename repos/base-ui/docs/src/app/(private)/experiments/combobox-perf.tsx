'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import styles from './combobox-perf.module.css';

export default function ExampleCombobox() {
  return (
    <div>
      <h2>With manually specified index</h2>
      <Combobox.Root items={fruits}>
        <label className={styles.Label}>
          Choose a fruit
          <Combobox.Input placeholder="e.g. Apple" className={styles.Input} />
          <div className={styles.ActionButtons}>
            <Combobox.Clear className={styles.Clear} aria-label="Clear selection">
              <ClearIcon className={styles.ClearIcon} />
            </Combobox.Clear>
            <Combobox.Trigger className={styles.Trigger} aria-label="Open popup">
              <ChevronDownIcon className={styles.TriggerIcon} />
            </Combobox.Trigger>
          </div>
        </label>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.Empty className={styles.Empty}>No fruits found.</Combobox.Empty>
              <Combobox.List className={styles.List}>
                {(item: string, index: number) => (
                  <Combobox.Item key={item} value={item} index={index} className={styles.Item}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Combobox.ItemIndicator>
                    <div className={styles.ItemText}>{item}</div>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <hr style={{ marginBlock: '1rem' }} />

      <h2>Without manually specified index</h2>
      <Combobox.Root items={fruits}>
        <label className={styles.Label}>
          Choose a fruit
          <Combobox.Input placeholder="e.g. Apple" className={styles.Input} />
          <div className={styles.ActionButtons}>
            <Combobox.Clear className={styles.Clear} aria-label="Clear selection">
              <ClearIcon className={styles.ClearIcon} />
            </Combobox.Clear>
            <Combobox.Trigger className={styles.Trigger} aria-label="Open popup">
              <ChevronDownIcon className={styles.TriggerIcon} />
            </Combobox.Trigger>
          </div>
        </label>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.Empty className={styles.Empty}>No fruits found.</Combobox.Empty>
              <Combobox.List className={styles.List}>
                {(item: string) => (
                  <Combobox.Item key={item} value={item} className={styles.Item}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Combobox.ItemIndicator>
                    <div className={styles.ItemText}>{item}</div>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <hr style={{ marginBlock: '1rem' }} />

      <h2>Open API (no filtering)</h2>
      <Combobox.Root>
        <label className={styles.Label}>
          Choose a fruit
          <Combobox.Input placeholder="e.g. Apple" className={styles.Input} />
          <div className={styles.ActionButtons}>
            <Combobox.Clear className={styles.Clear} aria-label="Clear selection">
              <ClearIcon className={styles.ClearIcon} />
            </Combobox.Clear>
            <Combobox.Trigger className={styles.Trigger} aria-label="Open popup">
              <ChevronDownIcon className={styles.TriggerIcon} />
            </Combobox.Trigger>
          </div>
        </label>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.List className={styles.List}>
                {fruits.map((item) => (
                  <Combobox.Item key={item} value={item} className={styles.Item}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Combobox.ItemIndicator>
                    <div className={styles.ItemText}>{item}</div>
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
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

const fruits = Array.from({ length: 1000 }, (_, i) => `Item ${i + 1}`);
