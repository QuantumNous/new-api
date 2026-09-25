'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Popover } from '@base-ui/react/popover';
import { Field } from '@base-ui/react/field';
import { Switch } from './Switch';
import { Input } from './Input';
import { Select } from './Select';
import classes from './SettingsPanel.module.css';

export interface ExperimentsSettingsContext<Settings = Record<string, unknown>> {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const ExperimentSettingsContext = React.createContext<
  ExperimentsSettingsContext | undefined
>(undefined);

export function ExperimentSettingsProvider<Settings extends {}>(
  props: React.PropsWithChildren<{ metadata: SettingsMetadata<Settings> }>,
) {
  const [settingsState, setSettings] = React.useState<Settings>({} as Settings);
  const { metadata, children } = props;
  const isInitializedRef = React.useRef(false);

  const settings = settingsState;

  if (!isInitializedRef.current && metadata != null) {
    Object.keys(metadata).forEach((key) => {
      const fieldMetadata = metadata[key as keyof Settings];
      if (fieldMetadata.default !== undefined) {
        settings[key as keyof Settings] = fieldMetadata.default as any;
      } else {
        switch (fieldMetadata.type) {
          case 'boolean':
            (settings[key as keyof Settings] as any) = false;
            break;
          case 'number':
            (settings[key as keyof Settings] as any) = 0;
            break;
          case 'string':
            (settings[key as keyof Settings] as any) = '';
            break;
          default:
            break;
        }
      }
    });

    isInitializedRef.current = true;
    setSettings(settings);
  }

  const context = React.useMemo(
    () => ({
      settings,
      setSettings,
    }),
    [settings],
  );

  return (
    <ExperimentSettingsContext value={context as ExperimentsSettingsContext}>
      {children}
    </ExperimentSettingsContext>
  );
}

export function useExperimentSettings<Settings extends {}>() {
  const context = React.useContext(ExperimentSettingsContext);
  if (!context) {
    throw new Error('useExperimentSettings must be used within an ExperimentSettingsProvider');
  }

  return context as ExperimentsSettingsContext<Settings>;
}

export function SettingsPanel<Settings extends {}>(props: SettingsPanelProps<Settings>) {
  const { metadata, renderAsPopup = true, className, ...otherProps } = props;
  const { settings, setSettings } = useExperimentSettings<Settings>();

  const createChangeHandler = React.useCallback(
    (key: string) => (value: unknown) => {
      setSettings((oldSettings) => ({
        ...oldSettings,
        [key]: value,
      }));
    },
    [setSettings],
  );

  if (!metadata) {
    return null;
  }

  const controls = (
    <div {...otherProps} className={clsx(classes.settings, className)}>
      <h2>Settings</h2>
      {Object.keys(metadata).map((key) => {
        const value = (settings as Record<string, unknown>)[key];
        const fieldMetadata: FieldMetadata = metadata[key as keyof Settings];
        switch (fieldMetadata.type) {
          case 'boolean':
            return renderSwitch(
              key,
              fieldMetadata.label,
              value as boolean,
              createChangeHandler(key),
            );
          case 'number':
            return renderNumberInput(
              key,
              fieldMetadata.label,
              value as number,
              createChangeHandler(key),
            );
          case 'string':
            if (fieldMetadata.options) {
              return renderSelect(
                key,
                fieldMetadata.label,
                value as string,
                fieldMetadata.options,
                createChangeHandler(key),
              );
            }
            return renderTextInput(
              key,
              fieldMetadata.label,
              value as string,
              createChangeHandler(key),
            );
          default:
            return null;
        }
      })}
    </div>
  );

  if (renderAsPopup) {
    return <SettingsPopup>{controls}</SettingsPopup>;
  }

  return controls;
}

export interface FieldMetadata {
  label: string;
  type: 'boolean' | 'number' | 'string';
  options?: string[];
  default?: unknown;
}

export type SettingsMetadata<Settings> = Record<keyof Settings, FieldMetadata>;

export interface SettingsPanelProps<Settings> extends React.HTMLAttributes<HTMLDivElement> {
  metadata: SettingsMetadata<Settings>;
  renderAsPopup?: boolean;
}

function SettingsPopup(props: React.PropsWithChildren<{}>) {
  const [open, setOpen] = React.useState(false);
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean, eventDetails: { reason: string }) => {
      const reason = eventDetails.reason;
      if (!nextOpen && (reason === 'outside-press' || reason === 'focus-out')) {
        return;
      }

      setOpen(nextOpen);
    },
    [],
  );

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger className={classes.trigger}>
        <SettingsIcon className={classes.icon} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner align="end" side="bottom" sideOffset={8} positionMethod="fixed">
          <Popover.Popup className={classes.popup}>{props.children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function renderSwitch(
  key: string,
  label: string,
  value: boolean,
  onChange: (value: boolean) => void,
) {
  return (
    <Switch
      key={key}
      checked={value}
      onCheckedChange={onChange}
      label={label}
      className={classes.singleLineField}
    />
  );
}

function renderTextInput(
  key: string,
  label: string,
  value: string,
  onChange: (value: string) => void,
) {
  return (
    <Field.Root key={key} className={classes.multiLineField}>
      <Field.Label className={classes.fieldLabel}>{label}</Field.Label>
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={classes.input}
      />
    </Field.Root>
  );
}

function renderNumberInput(
  key: string,
  label: string,
  value: number,
  onChange: (value: number) => void,
) {
  return (
    <Field.Root key={key} className={classes.singleLineField}>
      <Field.Label className={classes.fieldLabel}>{label}</Field.Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className={classes.numberInput}
      />
    </Field.Root>
  );
}

function renderSelect(
  key: string,
  label: string,
  value: string,
  options: string[],
  onChange: (value: string | null) => void,
) {
  return (
    <Field.Root key={key} className={classes.multiLineField}>
      <Field.Label>{label}</Field.Label>
      <Select
        value={value}
        onChange={(newValue) => onChange(newValue)}
        options={options}
        className={classes.select}
      />
    </Field.Root>
  );
}

function SettingsIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      enableBackground="new 0 0 24 24"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      fill="currentColor"
      {...props}
    >
      <g>
        <path d="M0,0h24v24H0V0z" fill="none" />
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
      </g>
    </svg>
  );
}
