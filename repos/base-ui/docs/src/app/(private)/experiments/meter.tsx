'use client';
import * as React from 'react';
import { Meter } from '@base-ui/react/meter';
import { SettingsMetadata, useExperimentSettings } from './_components/SettingsPanel';
import styles from './meter.module.css';

interface Settings {
  value: number;
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  value: {
    type: 'number',
    label: 'Value',
    default: 77,
  },
};

export default function BatteryMeter() {
  const { settings } = useExperimentSettings<Settings>();
  return (
    <Meter.Root
      className={styles.Root}
      value={settings.value}
      aria-label="Battery percentage remaining"
    >
      <Meter.Track className={styles.Track}>
        <Meter.Indicator className={styles.Indicator} />
      </Meter.Track>
      <BoltIcon className={styles.Icon} />
    </Meter.Root>
  );
}

function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
      <path
        d="M10.67 21c-.35 0-.62-.31-.57-.66L11 14H7.5c-.88 0-.33-.75-.31-.78 1.26-2.23 3.15-5.53 5.65-9.93.1-.18.3-.29.5-.29.35 0 .62.31.57.66l-.9 6.34h3.51c.4 0 .62.19.4.66-3.29 5.74-5.2 9.09-5.75 10.05-.1.18-.29.29-.5.29z"
        fill="currentColor"
      />
    </svg>
  );
}
