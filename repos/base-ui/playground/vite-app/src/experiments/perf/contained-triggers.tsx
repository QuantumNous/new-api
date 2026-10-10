import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Tooltip } from '@base-ui/react/tooltip';
import { Popover } from '@base-ui/react/popover';
import { Dialog } from '@base-ui/react/dialog';
import { PreviewCard } from '@base-ui/react/preview-card';
import menuDemoStyles from 'docs/src/app/(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import tooltipDemoStyles from 'docs/src/app/(docs)/react/components/tooltip/demos/hero/css-modules/index.module.css';
import popoverDemoStyles from 'docs/src/app/(docs)/react/components/popover/demos/_index.module.css';
import dialogDemoStyles from 'docs/src/app/(docs)/react/components/dialog/demos/_index.module.css';
import previewCardDemoStyles from 'docs/src/app/(docs)/react/components/preview-card/demos/index.module.css';
import PerformanceBenchmark from './utils/benchmark';
import { type Settings, SettingsPanel, usePersistedSettings } from './SettingsPanel';
import styles from './perf.module.css';

interface RowData {
  label: string;
  index: number;
}

interface RowProps {
  rowData: RowData;
}

const rowCount = 500;
const menuItemCount = 50;

const rows = Array.from({ length: rowCount }).map((_, i) => ({
  label: `Row ${i + 1}`,
  index: i + 1,
}));

const menuItems = Array.from({ length: menuItemCount }).map((_, i) => ({
  label: `Menu Item ${i + 1}`,
  index: i + 1,
}));

export default function PerfExperiment() {
  const [settings, setSettings] = usePersistedSettings();

  return (
    <div className={styles.container}>
      <h1>Initial render performance - contained triggers</h1>
      <SettingsPanel settings={settings} onChange={setSettings} />
      <PerformanceBenchmark>
        <TestComponent settings={settings} />
      </PerformanceBenchmark>
    </div>
  );
}

function TestComponent(props: { settings: Settings }) {
  const { renderMenu, renderTooltip, renderPopover, renderDialog, renderPreviewCard } =
    props.settings;
  return (
    <div className={styles.rows}>
      {rows.map((row) => (
        <div key={row.index} className={styles.row}>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.actions}>
            {renderDialog && <StyledDialog rowData={row} />}
            {renderMenu && <StyledMenu rowData={row} />}
            {renderPopover && <StyledPopover rowData={row} />}
            {renderPreviewCard && <StyledPreviewCard rowData={row} />}
            {renderTooltip && <StyledTooltip rowData={row} />}
          </span>
        </div>
      ))}
    </div>
  );
}

function StyledMenu({ rowData }: RowProps) {
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.button} data-id={rowData.index}>
        Menu
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} className={menuDemoStyles.Positioner}>
          <Menu.Popup className={menuDemoStyles.Popup}>
            <Menu.Arrow className={menuDemoStyles.Arrow}>
              <ArrowSvg />
            </Menu.Arrow>
            {menuItems.map((item) => (
              <Menu.Item
                key={item.index}
                onClick={() => console.log(`Clicked ${item.label} for ${rowData.label}`)}
                className={menuDemoStyles.Item}
              >
                {item.label} for {rowData.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function StyledPopover({ rowData }: RowProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.button} data-id={rowData.index}>
        Popover
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className={popoverDemoStyles.Positioner}>
          <Popover.Popup className={popoverDemoStyles.Popup}>
            <Popover.Arrow className={popoverDemoStyles.Arrow}>
              <ArrowSvg />
            </Popover.Arrow>
            {rowData && <div>Popover for {rowData.label}</div>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function StyledTooltip({ rowData }: RowProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className={styles.button} data-id={rowData.index}>
        Tooltip
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup className={tooltipDemoStyles.Popup}>
            <Tooltip.Arrow className={tooltipDemoStyles.Arrow}>
              <ArrowSvg />
            </Tooltip.Arrow>
            Tooltip for {rowData.label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function StyledDialog({ rowData }: RowProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.button} data-id={rowData.index}>
        Dialog
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogDemoStyles.Backdrop} />
        <Dialog.Popup className={dialogDemoStyles.Popup}>
          <Dialog.Title className={dialogDemoStyles.Title}>Dialog</Dialog.Title>
          <Dialog.Description className={dialogDemoStyles.Description}>
            Dialog content for {rowData.label}
          </Dialog.Description>
          <div className={dialogDemoStyles.Actions}>
            <Dialog.Close className={dialogDemoStyles.Button}>Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StyledPreviewCard({ rowData }: RowProps) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        className={styles.button}
        href="#"
        data-id={rowData.index}
        onClick={(event) => event.preventDefault()}
      >
        Preview Card
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8} className={previewCardDemoStyles.Positioner}>
          <PreviewCard.Popup className={previewCardDemoStyles.Popup}>
            <PreviewCard.Arrow className={previewCardDemoStyles.Arrow}>
              <PreviewCardArrowSvg />
            </PreviewCard.Arrow>
            <div className={previewCardDemoStyles.PopupContent} style={{ width: 'max-content' }}>
              <p className={previewCardDemoStyles.Summary}>Preview for {rowData.label}</p>
            </div>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={menuDemoStyles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={menuDemoStyles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={menuDemoStyles.ArrowInnerStroke}
      />
    </svg>
  );
}

function PreviewCardArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={previewCardDemoStyles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={previewCardDemoStyles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={previewCardDemoStyles.ArrowInnerStroke}
      />
    </svg>
  );
}
