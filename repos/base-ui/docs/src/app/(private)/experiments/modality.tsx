'use client';

import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { Menu } from '@base-ui/react/menu';
import { Dialog } from '@base-ui/react/dialog';
import styles from './modality.module.css';

export default function Modality() {
  const [modal, setModal] = React.useState(true);
  const [withBackdrop, setWithBackdrop] = React.useState(false);

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
      <SelectDemo modal={modal} withBackdrop={withBackdrop} />
      <MenuDemo modal={modal} withBackdrop={withBackdrop} />
      <DialogDemo modal={modal} withBackdrop={withBackdrop} />
    </div>
  );
}

function SelectDemo({ modal, withBackdrop }: Props) {
  return (
    <Select.Root defaultValue="system" modal={modal}>
      <Select.Trigger aria-label="Select font" className={styles.Trigger}>
        <Select.Value />
        <Select.Icon className={styles.SelectDropdownArrow} />
      </Select.Trigger>

      {withBackdrop && <Select.Backdrop className={styles.Backdrop} />}

      <Select.Portal>
        <Select.Positioner
          sideOffset={5}
          className={styles.Positioner}
          alignItemWithTrigger={false}
        >
          <Select.Popup className={styles.SelectPopup}>
            <Select.Item value="system" className={styles.SelectItem}>
              <Select.ItemIndicator render={<CheckIcon />} className={styles.SelectItemIndicator} />
              <Select.ItemText>System font</Select.ItemText>
            </Select.Item>
            <Select.Item value="arial" className={styles.SelectItem}>
              <Select.ItemIndicator render={<CheckIcon />} className={styles.SelectItemIndicator} />
              <Select.ItemText>Arial</Select.ItemText>
            </Select.Item>
            <Select.Item value="roboto" className={styles.SelectItem}>
              <Select.ItemIndicator render={<CheckIcon />} className={styles.SelectItemIndicator} />
              <Select.ItemText>Roboto</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function MenuDemo({ modal, withBackdrop }: Props) {
  return (
    <Menu.Root modal={modal}>
      <Menu.Trigger className={styles.Trigger}>Open Menu</Menu.Trigger>

      {withBackdrop && <Menu.Backdrop className={styles.Backdrop} />}

      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8} className={styles.Positioner}>
          <Menu.Popup className={styles.MenuPopup}>
            <Menu.Item onClick={() => console.log('Log out clicked')} className={styles.MenuItem}>
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function DialogDemo({ modal, withBackdrop }: Props) {
  return (
    <Dialog.Root modal={modal}>
      <Dialog.Trigger className={styles.Trigger}>Open Dialog</Dialog.Trigger>

      {withBackdrop && <Dialog.Backdrop className={styles.Backdrop} />}

      <Dialog.Portal>
        <Dialog.Popup className={styles.DialogPopup}>
          <Dialog.Title>Subscribe</Dialog.Title>
          <Dialog.Description>
            Enter your email address to subscribe to our newsletter.
          </Dialog.Description>
          <div className={styles.DialogControls}>
            <Dialog.Close className={styles.DialogCloseButton}>Subscribe</Dialog.Close>
            <Dialog.Close className={styles.DialogCloseButton}>Cancel</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface Props {
  modal: boolean;
  withBackdrop: boolean;
}

const CheckIcon = function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
    </svg>
  );
};
