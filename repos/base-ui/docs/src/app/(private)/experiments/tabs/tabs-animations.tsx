'use client';
import * as React from 'react';
import clsx from 'clsx';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Tabs } from '@base-ui/react/tabs';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import '../../../../demo-data/theme/css-modules/theme.css';
import classes from './tabs-animations.module.css';

const PANELS = [
  {
    title: 'Overview',
    description: 'Track progress across releases and monitor status updates.',
  },
  {
    title: 'Metrics',
    description: 'Compare usage trends and adoption between environments.',
  },
  {
    title: 'Activity',
    description: 'Review recent changes and confirm deployment timings.',
  },
  {
    title: 'Settings',
    description: 'Adjust notifications, access, and panel behaviors.',
  },
];

export default function TabsAnimationsExperiment() {
  const { settings } = useExperimentSettings<Settings>();
  const [value, setValue] = React.useState<number | null>(0);

  return (
    <div className={classes.experiment} dir={settings.direction}>
      <DirectionProvider direction={settings.direction}>
        <header className={classes.header}>
          <h1>Tabs panel transitions</h1>
          <p className={classes.subtitle}>
            Panels animate based on data-starting-style, data-ending-style, and activation
            direction.
          </p>
        </header>
        <Tabs.Root
          className={classes.tabs}
          value={value}
          onValueChange={setValue}
          orientation={settings.orientation}
        >
          <Tabs.List className={classes.list}>
            {PANELS.map((panel, index) => (
              <Tabs.Tab className={classes.tab} key={panel.title} value={index}>
                {panel.title}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator
              className={clsx(classes.indicator, settings.elastic && classes.elastic)}
            />
          </Tabs.List>
          <div className={classes.panels}>
            {PANELS.map((panel, index) => (
              <Tabs.Panel
                className={classes.panel}
                key={panel.title}
                keepMounted={settings.keepMounted}
                value={index}
              >
                <div className={classes.panelContent}>
                  <h2 className={classes.panelTitle}>{panel.title}</h2>
                  <p className={classes.panelDescription}>{panel.description}</p>
                </div>
              </Tabs.Panel>
            ))}
          </div>
        </Tabs.Root>
      </DirectionProvider>
    </div>
  );
}

interface Settings {
  direction: 'ltr' | 'rtl';
  orientation: 'horizontal' | 'vertical';
  keepMounted: boolean;
  elastic: boolean;
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  direction: {
    type: 'string',
    label: 'Direction',
    options: ['ltr', 'rtl'],
    default: 'ltr',
  },
  orientation: {
    type: 'string',
    label: 'Orientation',
    options: ['horizontal', 'vertical'],
    default: 'horizontal',
  },
  keepMounted: {
    type: 'boolean',
    label: 'Keep mounted',
    default: false,
  },
  elastic: {
    type: 'boolean',
    label: 'Elastic indicator',
    default: false,
  },
};
