'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import styles from './priority-combobox.module.css';

function CustomCombobox(props: { items: Priority[] }) {
  return (
    <Combobox.Root items={props.items} defaultValue={props.items?.[0]} autoHighlight>
      <Combobox.Trigger className={styles.Trigger}>
        <Combobox.Value>
          {(priority: Priority) => (
            <div className={styles.TriggerValue}>
              {priority.icon}
              <span>{priority.label ?? priority.value}</span>
            </div>
          )}
        </Combobox.Value>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} disableAnchorTracking={true}>
          <Combobox.Popup className={styles.Popup} aria-label="Select priority">
            <div className={styles.InputRow}>
              <Combobox.Input placeholder="Set priority to…" className={styles.Input} />
              <div className={styles.ShortcutKey}>P</div>
            </div>
            <Combobox.Separator className={styles.Separator} />
            <Combobox.Empty className={styles.Empty}>No priority found.</Combobox.Empty>
            <Combobox.List className={styles.List}>
              {(priority: Priority) => (
                <Combobox.Item key={priority.code} value={priority} className={styles.Item}>
                  <div className={styles.ItemIcon}>{priority.icon}</div>
                  <div className={styles.ItemText}>{priority.label ?? priority.value}</div>
                  <Combobox.ItemIndicator className={styles.ItemIndicator}>
                    <CheckIcon className={styles.ItemIndicatorIcon} />
                  </Combobox.ItemIndicator>
                  <div className={styles.ItemCode}>{priority.code}</div>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export default function PriorityCombobox() {
  return <CustomCombobox items={priorities} />;
}

interface Priority {
  code: string;
  value: string | null;
  icon: React.ReactNode;
  label: string;
}

const priorities: Priority[] = [
  { code: '0', value: '0', icon: <MinusIcon />, label: 'No priority' },
  { code: '1', value: '1', icon: <CircleAlertIcon />, label: 'Urgent' },
  { code: '2', value: '2', icon: <SignalHighIcon />, label: 'High' },
  { code: '3', value: '3', icon: <SignalMediumIcon />, label: 'Medium' },
  { code: '4', value: '4', icon: <SignalLowIcon />, label: 'Low' },
];

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function MinusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path d="M0 8H15"></path>
    </svg>
  );
}

function CircleAlertIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function SignalHighIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path strokeWidth="4" d="M2 20h.01" />
      <path strokeWidth="4" d="M8 20v-4" />
      <path strokeWidth="4" d="M14 20v-8" />
      <path strokeWidth="4" d="M20 20V8" />
    </svg>
  );
}

function SignalMediumIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path strokeWidth="4" d="M2 20h.01" />
      <path strokeWidth="4" d="M8 20v-4" />
      <path strokeWidth="4" d="M14 20v-8" />
      <path strokeWidth="4" d="M20 20V8" stroke="lightgrey" />
    </svg>
  );
}

function SignalLowIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path strokeWidth="4" d="M2 20h.01" />
      <path strokeWidth="4" d="M8 20v-4" />
      <path strokeWidth="4" d="M14 20v-8" stroke="lightgrey" />
      <path strokeWidth="4" d="M20 20V8" stroke="lightgrey" />
    </svg>
  );
}
