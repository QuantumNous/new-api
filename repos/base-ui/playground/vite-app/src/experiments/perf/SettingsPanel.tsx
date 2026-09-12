import * as React from 'react';
import styles from './perf.module.css';

export interface Settings {
  renderDialog: boolean;
  renderMenu: boolean;
  renderPopover: boolean;
  renderPreviewCard: boolean;
  renderTooltip: boolean;
}

export const defaultSettings: Settings = {
  renderDialog: true,
  renderMenu: true,
  renderPopover: true,
  renderPreviewCard: true,
  renderTooltip: true,
};

const settingsStorageKey = 'base-ui:perf-settings';

const settingRows: Array<{ key: keyof Settings; label: string }> = [
  { key: 'renderDialog', label: 'Dialog' },
  { key: 'renderMenu', label: 'Menu' },
  { key: 'renderPopover', label: 'Popover' },
  { key: 'renderPreviewCard', label: 'Preview Card' },
  { key: 'renderTooltip', label: 'Tooltip' },
];

interface SettingsPanelProps {
  settings: Settings;
  onChange: React.Dispatch<React.SetStateAction<Settings>>;
}

function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') {
    return defaultSettings;
  }

  const record = value as Partial<Settings>;
  return {
    renderDialog:
      typeof record.renderDialog === 'boolean' ? record.renderDialog : defaultSettings.renderDialog,
    renderMenu:
      typeof record.renderMenu === 'boolean' ? record.renderMenu : defaultSettings.renderMenu,
    renderPopover:
      typeof record.renderPopover === 'boolean'
        ? record.renderPopover
        : defaultSettings.renderPopover,
    renderPreviewCard:
      typeof record.renderPreviewCard === 'boolean'
        ? record.renderPreviewCard
        : defaultSettings.renderPreviewCard,
    renderTooltip:
      typeof record.renderTooltip === 'boolean'
        ? record.renderTooltip
        : defaultSettings.renderTooltip,
  };
}

function readStoredSettings(): Settings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(settingsStorageKey);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function usePersistedSettings(): [Settings, React.Dispatch<React.SetStateAction<Settings>>] {
  const [settings, setSettings] = React.useState<Settings>(readStoredSettings);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch {
      // Ignore write failures (storage might be unavailable).
    }
  }, [settings]);

  return [settings, setSettings];
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { settings, onChange } = props;

  return (
    <fieldset className={styles.settingsPanel}>
      <legend className={styles.settingsLegend}>Render components</legend>
      <div className={styles.settingsGrid}>
        {settingRows.map((row) => (
          <label key={row.key} className={styles.settingsRow}>
            <input
              type="checkbox"
              className={styles.settingsCheckbox}
              checked={settings[row.key]}
              onChange={(event) => {
                const nextChecked = event.currentTarget.checked;
                onChange((prev) => ({
                  ...prev,
                  [row.key]: nextChecked,
                }));
              }}
            />
            <span>{row.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
