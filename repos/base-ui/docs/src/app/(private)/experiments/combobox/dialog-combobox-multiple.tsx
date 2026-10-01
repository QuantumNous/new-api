'use client';
import * as React from 'react';
import { Combobox, Dialog } from '@base-ui/react';
import styles from './dialog-combobox.module.css';
import { fruits } from './dialog-combobox';

export default function DialogComboboxMultiple() {
  const [open, setOpen] = React.useState(false);
  const inputId = React.useId();

  return (
    <Combobox.Root items={fruits} multiple open={open} onOpenChange={setOpen} inline>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className={styles.Button}>
          <Combobox.Value>
            {(value: string[]) => {
              if (value.length === 0) {
                return 'Select fruits';
              }
              if (value.length === 1) {
                return value[0];
              }
              return `${value.length} fruits selected`;
            }}
          </Combobox.Value>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.Backdrop} />
          <div className={styles.Viewport}>
            <Dialog.Popup className={styles.Popup}>
              <Dialog.Title className={styles.Title}>Choose fruits</Dialog.Title>
              <Dialog.Description className={styles.Description}>
                Pick one or more fruits to fill today&apos;s order.
              </Dialog.Description>
              <div className={styles.Label}>
                <label htmlFor={inputId}>Fruits</label>
                <Combobox.Chips className={styles.Chips}>
                  <Combobox.Value>
                    {(value: string[]) => (
                      <React.Fragment>
                        {value.map((fruit) => (
                          <Combobox.Chip key={fruit} className={styles.Chip} aria-label={fruit}>
                            {fruit}
                            <Combobox.ChipRemove
                              className={styles.ChipRemove}
                              aria-label={`Remove ${fruit}`}
                            >
                              <XIcon className={styles.ChipRemoveIcon} />
                            </Combobox.ChipRemove>
                          </Combobox.Chip>
                        ))}
                        <Combobox.Input
                          id={inputId}
                          placeholder={value.length === 0 ? 'e.g. Apple' : ''}
                          className={styles.ChipsInput}
                        />
                      </React.Fragment>
                    )}
                  </Combobox.Value>
                </Combobox.Chips>
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

function XIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
