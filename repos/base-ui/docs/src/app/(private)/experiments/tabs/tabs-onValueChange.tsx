'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Tabs } from '@base-ui/react/tabs';
import '../../../../demo-data/theme/css-modules/theme.css';
import { Button } from '../_components/Button';
import { Input } from '../_components/Input';
import { Switch } from '../_components/Switch';
import classes from './tabs-onValueChange.module.css';
import sharedTabsClasses from './tabs-basic.module.css';

type TabId = 0 | 1 | 2;

interface TabConfig {
  id: TabId;
  label: string;
  disabled: boolean;
  rendered: boolean;
}

interface ChangeEventEntry {
  id: number;
  reason: Tabs.Root.ChangeEventDetails['reason'];
  value: string;
}

const INITIAL_TABS: TabConfig[] = [
  { id: 0, label: 'Overview', disabled: false, rendered: true },
  { id: 1, label: 'Details', disabled: false, rendered: true },
  { id: 2, label: 'Activity', disabled: false, rendered: true },
];

export default function TabsRegressionExperiment() {
  const [tabs, setTabs] = React.useState(INITIAL_TABS);
  const [defaultValueInput, setDefaultValueInput] = React.useState('0');
  const [appliedDefaultValue, setAppliedDefaultValue] = React.useState<Tabs.Tab.Value | undefined>(
    0,
  );
  const [keepPanelsMounted, setKeepPanelsMounted] = React.useState(true);
  const [mountKey, setMountKey] = React.useState(0);
  const [events, setEvents] = React.useState<ChangeEventEntry[]>([]);

  const parsedDefaultValue = React.useMemo(
    () => parseDefaultValue(defaultValueInput),
    [defaultValueInput],
  );
  const renderedTabs = tabs.filter((tab) => tab.rendered);

  const updateTab = React.useCallback((id: TabId, patch: Partial<TabConfig>) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id !== id) {
          return tab;
        }

        return { ...tab, ...patch };
      }),
    );
  }, []);

  const handleRemount = React.useCallback(() => {
    setEvents([]);
    setAppliedDefaultValue(parsedDefaultValue);
    setMountKey((prevKey) => prevKey + 1);
  }, [parsedDefaultValue]);

  const handleReset = React.useCallback(() => {
    setTabs(INITIAL_TABS);
    setDefaultValueInput('0');
    setAppliedDefaultValue(0);
    setKeepPanelsMounted(true);
    setEvents([]);
    setMountKey((prevKey) => prevKey + 1);
  }, []);

  const handleValueChange = React.useCallback(
    (value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
      setEvents((prevEvents) => [
        {
          id: prevEvents.length + 1,
          reason: eventDetails.reason,
          value: formatValue(value),
        },
        ...prevEvents,
      ]);
    },
    [],
  );

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div>
          <h1 className={classes.title}>Tabs onValueChange</h1>
          <p className={classes.description}>
            Toggle tabs on and off, change the next <code>defaultValue</code>, then remount to test
            fallback behavior manually. Switch panel mounting modes to check stale visibility and
            remount behavior.
          </p>
        </div>
        <div className={classes.summary}>
          <div>Mount key: {mountKey}</div>
          <div>Next defaultValue: {formatValue(parsedDefaultValue)}</div>
          <div>Rendered tabs: {renderedTabs.length}</div>
          <div>Panels keepMounted: {keepPanelsMounted ? 'yes' : 'no'}</div>
        </div>
      </div>

      <div className={classes.layout}>
        <section className={classes.controlsPanel}>
          <div className={classes.controlsHeader}>
            <label className={classes.inputLabel}>
              <span>Next defaultValue</span>
              <Input
                className={classes.input}
                value={defaultValueInput}
                onChange={(event) => setDefaultValueInput(event.currentTarget.value)}
                placeholder='0, 1, 2, 999, "abc", null'
              />
            </label>
            <p className={classes.hint}>
              Numeric strings become numbers, <code>null</code> becomes <code>null</code>, empty
              field becomes <code>undefined</code>, and any other text stays a string.
            </p>
            <div className={classes.buttonRow}>
              <Button variant="text" onClick={handleRemount}>
                Remount Tabs
              </Button>
              <Button variant="text" onClick={handleReset}>
                Reset everything
              </Button>
            </div>
            <Switch
              label="Keep panels mounted"
              checked={keepPanelsMounted}
              onCheckedChange={setKeepPanelsMounted}
            />
          </div>

          <div className={classes.tabControls}>
            {tabs.map((tab) => (
              <div key={tab.id} className={classes.tabRow}>
                <div className={classes.tabMeta}>
                  <strong>{tab.label}</strong>
                  <span>value={tab.id}</span>
                </div>
                <div className={classes.switches}>
                  <Switch
                    label="Rendered"
                    checked={tab.rendered}
                    onCheckedChange={(checked) => updateTab(tab.id, { rendered: checked })}
                  />
                  <Switch
                    label="Disabled"
                    checked={tab.disabled}
                    onCheckedChange={(checked) => updateTab(tab.id, { disabled: checked })}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={classes.previewPanel}>
          <div className={classes.previewCard}>
            <Tabs.Root
              key={mountKey}
              className={sharedTabsClasses.tabs}
              defaultValue={appliedDefaultValue}
              onValueChange={handleValueChange}
            >
              <Tabs.List className={sharedTabsClasses.list}>
                {tabs.map((tab) =>
                  tab.rendered ? (
                    <Tabs.Tab
                      key={tab.id}
                      className={sharedTabsClasses.tab}
                      value={tab.id}
                      disabled={tab.disabled}
                    >
                      {tab.label}
                    </Tabs.Tab>
                  ) : null,
                )}
              </Tabs.List>

              {tabs.map((tab) => (
                <Tabs.Panel
                  key={tab.id}
                  className={clsx(sharedTabsClasses.panel, !tab.rendered && classes.panelGhost)}
                  value={tab.id}
                  keepMounted={keepPanelsMounted}
                >
                  <div className={classes.panelDetails}>
                    <strong>{tab.label}</strong>
                    <span>Panel value: {tab.id}</span>
                    <span>Tab disabled: {tab.disabled ? 'yes' : 'no'}</span>
                  </div>
                </Tabs.Panel>
              ))}
            </Tabs.Root>
          </div>

          <div className={classes.logCard}>
            <div className={classes.logHeader}>
              <h2>onValueChange log</h2>
              <Button variant="text" onClick={() => setEvents([])}>
                Clear log
              </Button>
            </div>
            {events.length === 0 ? (
              <p className={classes.emptyState}>No events yet.</p>
            ) : (
              <ol className={classes.logList}>
                {events.map((event) => (
                  <li key={event.id} className={classes.logItem}>
                    <span>#{event.id}</span>
                    <span>value={event.value}</span>
                    <span>reason={event.reason}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function parseDefaultValue(value: string): Tabs.Tab.Value | undefined {
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return undefined;
  }

  if (trimmedValue === 'null') {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return trimmedValue;
}

function formatValue(value: Tabs.Tab.Value | undefined) {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  return JSON.stringify(value);
}
