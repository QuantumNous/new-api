'use client';
import * as React from 'react';
import clsx from 'clsx';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Tabs } from '@base-ui/react/tabs';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import '../../../../demo-data/theme/css-modules/theme.css';
import classes from './tabs-basic.module.css';

export default function TabsExperiment() {
  const [value, setValue] = React.useState<string | number | null>(0);
  const { settings } = useExperimentSettings<Settings>();

  const direction = settings.direction;

  return (
    <div dir={direction}>
      <DirectionProvider direction={direction}>
        <h1>Tabs</h1>
        <Tabs.Root
          className={classes.tabs}
          value={value}
          onValueChange={(val) => setValue(val)}
          orientation={settings.orientation}
        >
          <Tabs.List className={classes.list} activateOnFocus={settings.activateOnFocus}>
            <Tabs.Tab className={classes.tab} value={0}>
              Code
            </Tabs.Tab>
            <Tabs.Tab className={classes.tab} value={1}>
              Issues
            </Tabs.Tab>
            <Tabs.Tab className={classes.tab} value={2}>
              Pull Requests
            </Tabs.Tab>
            <Tabs.Tab className={classes.tab} value={3} disabled>
              Discussions
            </Tabs.Tab>
            <Tabs.Tab className={classes.tab} value={4}>
              Actions
            </Tabs.Tab>
            <Tabs.Indicator
              className={clsx(classes.indicator, settings.elasticIndicator && classes.elastic)}
            />
          </Tabs.List>
          <Tabs.Panel className={classes.panel} value={0} keepMounted>
            Code panel
          </Tabs.Panel>
          <Tabs.Panel className={classes.panel} value={1} keepMounted>
            Issues panel
          </Tabs.Panel>
          <Tabs.Panel className={classes.panel} value={2} keepMounted>
            Pull Requests panel
          </Tabs.Panel>
          <Tabs.Panel className={classes.panel} value={3} keepMounted>
            Discussions panel
          </Tabs.Panel>
          <Tabs.Panel className={classes.panel} value={4} keepMounted>
            Actions panel
          </Tabs.Panel>
        </Tabs.Root>
      </DirectionProvider>
    </div>
  );
}

interface Settings {
  direction: 'ltr' | 'rtl';
  orientation: 'horizontal' | 'vertical';
  activateOnFocus: boolean;
  elasticIndicator: boolean;
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
  activateOnFocus: {
    type: 'boolean',
    label: 'Activate on focus',
    default: true,
  },
  elasticIndicator: {
    type: 'boolean',
    label: 'Elastic indicator',
  },
};
