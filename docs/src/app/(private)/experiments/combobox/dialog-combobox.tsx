'use client';
import * as React from 'react';
import { Combobox, Dialog } from '@base-ui/react';
import styles from './dialog-combobox.module.css';

export default function DialogCombobox() {
  const [open, setOpen] = React.useState<boolean>(false);
  const inputId = React.useId();

  return (
    <Combobox.Root items={fruits} open={open} onOpenChange={setOpen} inline>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className={styles.Button}>
          <Combobox.Value>{(value: string | null) => value || 'Select a fruit'}</Combobox.Value>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.Backdrop} />
          <div className={styles.Viewport}>
            <Dialog.Popup className={styles.Popup}>
              <Dialog.Title className={styles.Title}>Choose a fruit</Dialog.Title>
              <Dialog.Description className={styles.Description}>
                Pick a fruit to fill today&apos;s order.
              </Dialog.Description>
              <div className={styles.Label}>
                <label htmlFor={inputId}>Fruit</label>
                <div className={styles.InputWrapper}>
                  <Combobox.Input id={inputId} placeholder="e.g. Apple" className={styles.Input} />
                </div>
              </div>
              <div className={styles.Results}>
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
              </div>
              <div className={styles.Actions}>
                <Dialog.Close className={styles.Button}>Done</Dialog.Close>
              </div>
            </Dialog.Popup>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
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

export const fruits: string[] = [
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
