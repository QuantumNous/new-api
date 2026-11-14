'use client';
import * as React from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { Tooltip } from '@base-ui/react/tooltip';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Select } from '@base-ui/react/select';
import { NumberField } from '@base-ui/react/number-field';
import { Menu } from '@base-ui/react/menu';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import toolbarClasses from './toolbar.module.css';
import selectClasses from '../../../(docs)/react/components/select/demos/hero/css-modules/index.module.css';
import tooltipClasses from '../../../(docs)/react/components/tooltip/demos/hero/css-modules/index.module.css';
import menuClasses from '../../../(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import numberFieldClasses from '../../../(docs)/react/components/number-field/demos/hero/css-modules/index.module.css';
import '../../../../demo-data/theme/css-modules/theme.css';
import {
  BoldIcon,
  ItalicsIcon,
  UnderlineIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  ArrowSvg,
  ChevronUpDownIcon,
  CheckIcon,
  MoreHorizontalIcon,
  ChevronRightIcon,
  CursorGrowIcon,
  MinusIcon,
  PlusIcon,
} from './_icons';

interface Settings extends Record<string, boolean> {}

export const settingsMetadata: SettingsMetadata<Settings> = {
  selectDisabled: {
    type: 'boolean',
    label: 'Select disabled',
    default: false,
  },
  boldDisabled: {
    type: 'boolean',
    label: 'Bold disabled',
  },
  italicsDisabled: {
    type: 'boolean',
    label: 'Italics disabled',
  },
  underlineDisabled: {
    type: 'boolean',
    label: 'Underline disabled',
  },
  menuDisabled: {
    type: 'boolean',
    label: 'Menu disabled',
  },
  toolbarDisabled: {
    type: 'boolean',
    label: 'Everything disabled',
    default: false,
  },
};

const styles = {
  toolbar: toolbarClasses,
  tooltip: tooltipClasses,
  select: selectClasses,
  menu: menuClasses,
  numField: numberFieldClasses,
};

function classNames(...c: Array<string | undefined | null | false>) {
  return c.filter(Boolean).join(' ');
}

function renderToggleWithTooltip(args: {
  key: string;
  label: string;
  icon: (props: React.ComponentProps<'svg'>) => React.JSX.Element;
  disabled?: boolean;
}) {
  const { key, label, icon: Icon, disabled = false } = args;
  return (
    <Tooltip.Root key={key}>
      <Tooltip.Trigger
        render={
          <Toolbar.Button
            render={<Toggle />}
            aria-label={label}
            value={key}
            className={styles.toolbar.Toggle}
            disabled={disabled}
          >
            <Icon className={styles.toolbar.Icon} />
          </Toolbar.Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup className={styles.tooltip.Popup}>
            <Tooltip.Arrow
              className={classNames(styles.tooltip.Arrow, styles.toolbar.TooltipArrow)}
            >
              <ArrowSvg className={styles.toolbar.ArrowSvg} />
            </Tooltip.Arrow>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function App() {
  const { settings } = useExperimentSettings<Settings>();

  const SELECT_DISABLED = settings.toolbarDisabled || settings.selectDisabled;
  return (
    <React.Fragment>
      <a
        className={styles.toolbar.a}
        href="https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/"
        target="_blank"
      >
        <h3 className={styles.toolbar.h3}>Toolbar pattern</h3>
      </a>
      <div className={styles.toolbar.Wrapper}>
        <Tooltip.Provider>
          <Toolbar.Root className={styles.toolbar.Root}>
            <Select.Root defaultValue="sans">
              <Toolbar.Button
                disabled={SELECT_DISABLED}
                render={<Select.Trigger />}
                nativeButton={false}
                className={styles.select.Select}
              >
                <Select.Value />
                <Select.Icon className={styles.select.SelectIcon}>
                  <ChevronUpDownIcon />
                </Select.Icon>
              </Toolbar.Button>
              <Select.Portal>
                <Select.Positioner className={styles.select.Positioner} sideOffset={8}>
                  <Select.Popup
                    className={styles.select.Popup}
                    style={{ backgroundColor: 'var(--color-gray-50)' }}
                  >
                    <Select.Arrow className={styles.select.Arrow}>
                      <ArrowSvg className={styles.toolbar.ArrowSvg} />
                    </Select.Arrow>
                    <Select.Item className={styles.select.Item} value="sans">
                      <Select.ItemIndicator className={styles.select.ItemIndicator}>
                        <CheckIcon className={styles.select.ItemIndicatorIcon} />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.select.ItemText}>
                        Sans-serif
                      </Select.ItemText>
                    </Select.Item>
                    <Select.Item className={styles.select.Item} value="serif">
                      <Select.ItemIndicator className={styles.select.ItemIndicator}>
                        <CheckIcon className={styles.select.ItemIndicatorIcon} />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.select.ItemText}>Serif</Select.ItemText>
                    </Select.Item>
                    <Select.Item className={styles.select.Item} value="mono">
                      <Select.ItemIndicator className={styles.select.ItemIndicator}>
                        <CheckIcon className={styles.select.ItemIndicatorIcon} />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.select.ItemText}>
                        Monospace
                      </Select.ItemText>
                    </Select.Item>
                    <Select.Item className={styles.select.Item} value="cursive">
                      <Select.ItemIndicator className={styles.select.ItemIndicator}>
                        <CheckIcon className={styles.select.ItemIndicatorIcon} />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.select.ItemText}>Cursive</Select.ItemText>
                    </Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <NumberField.Root
                    defaultValue={16}
                    max={256}
                    min={1}
                    className={styles.numField.Field}
                  >
                    <NumberField.ScrubArea className={styles.numField.ScrubArea}>
                      <NumberField.ScrubAreaCursor className={styles.numField.ScrubAreaCursor}>
                        <CursorGrowIcon />
                      </NumberField.ScrubAreaCursor>
                    </NumberField.ScrubArea>

                    <NumberField.Group
                      className={classNames(styles.toolbar.NumberFieldGroup, styles.numField.Group)}
                    >
                      <NumberField.Decrement
                        className={styles.numField.Decrement}
                        disabled={settings.toolbarDisabled}
                      >
                        <MinusIcon />
                      </NumberField.Decrement>

                      <Toolbar.Input
                        className={styles.toolbar.Input}
                        disabled={settings.toolbarDisabled}
                        render={<NumberField.Input />}
                        aria-label="Font size"
                      />

                      <NumberField.Increment
                        className={styles.numField.Increment}
                        disabled={settings.toolbarDisabled}
                      >
                        <PlusIcon />
                      </NumberField.Increment>
                    </NumberField.Group>
                  </NumberField.Root>
                }
              />
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={10}>
                  <Tooltip.Popup className={styles.tooltip.Popup}>
                    <Tooltip.Arrow
                      className={classNames(styles.tooltip.Arrow, styles.toolbar.TooltipArrow)}
                    >
                      <ArrowSvg className={styles.toolbar.ArrowSvg} />
                    </Tooltip.Arrow>
                    Font size
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>

            <Toolbar.Separator className={styles.toolbar.Separator} />

            <ToggleGroup
              multiple
              defaultValue={[]}
              className={styles.toolbar.ToggleGroup}
              disabled={settings.toolbarDisabled}
            >
              {[
                {
                  key: 'bold',
                  label: 'Bold',
                  icon: BoldIcon,
                  disabled: settings.boldDisabled,
                },
                {
                  key: 'italics',
                  label: 'Italics',
                  icon: ItalicsIcon,
                  disabled: settings.italicsDisabled,
                },
                {
                  key: 'underline',
                  label: 'Underline',
                  icon: UnderlineIcon,
                  disabled: settings.underlineDisabled,
                },
              ].map(renderToggleWithTooltip)}
            </ToggleGroup>

            <Toolbar.Separator className={styles.toolbar.Separator} />

            <ToggleGroup
              defaultValue={['left']}
              className={styles.toolbar.ToggleGroup}
              disabled={settings.toolbarDisabled}
            >
              {[
                {
                  key: 'left',
                  label: 'Align left',
                  icon: AlignLeftIcon,
                  disabled: settings.toolbarDisabled,
                },
                {
                  key: 'center',
                  label: 'Align center',
                  icon: AlignCenterIcon,
                  disabled: settings.toolbarDisabled,
                },
                {
                  key: 'right',
                  label: 'Align right',
                  icon: AlignRightIcon,
                  disabled: settings.toolbarDisabled,
                },
              ].map(renderToggleWithTooltip)}
            </ToggleGroup>

            <Toolbar.Separator className={styles.toolbar.Separator} />

            <Menu.Root>
              <Toolbar.Button
                disabled={settings.toolbarDisabled || settings.menuDisabled}
                render={<Menu.Trigger />}
                className={styles.toolbar.More}
              >
                <MoreHorizontalIcon className={styles.toolbar.Icon} />
              </Toolbar.Button>
              <Menu.Portal>
                <Menu.Positioner
                  className={styles.menu.Positioner}
                  align="start"
                  side="inline-end"
                  sideOffset={8}
                >
                  <Menu.Popup className={styles.menu.Popup} style={{ backgroundColor: 'canvas' }}>
                    <Menu.Arrow
                      className={styles.menu.Arrow}
                      style={{
                        color: 'canvas',
                        transform: 'rotate(-90deg) translateY(-124%)',
                      }}
                    >
                      <ArrowSvg className={styles.toolbar.ArrowSvg} />
                    </Menu.Arrow>
                    <Menu.Item className={styles.menu.Item}>Help</Menu.Item>
                    <Menu.Item className={styles.menu.Item}>Keyboard Shortcuts</Menu.Item>
                    <Menu.Item className={styles.menu.Item}>Release Notes</Menu.Item>
                    <Menu.Separator className={styles.menu.Separator} />
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger className={styles.menu.SubmenuTrigger}>
                        Debug
                        <ChevronRightIcon />
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner
                          className={styles.menu.Positioner}
                          alignOffset={-4}
                          sideOffset={-4}
                        >
                          <Menu.Popup className={styles.menu.Popup}>
                            <Menu.Item className={styles.menu.Item}>Show debug log</Menu.Item>
                            <Menu.Item className={styles.menu.Item}>Show network log</Menu.Item>
                            <Menu.Item className={styles.menu.Item}>Show all logs</Menu.Item>
                            <Menu.Separator className={styles.menu.Separator} />
                            <Menu.Item className={styles.menu.Item}>Clear cache</Menu.Item>
                            <Menu.Item className={styles.menu.Item}>Clear local storage</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    <Menu.Separator className={styles.menu.Separator} />
                    <Menu.Item className={styles.menu.Item}>Log Out</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Toolbar.Root>
        </Tooltip.Provider>
        <textarea className={styles.toolbar.Textarea} name="" id="" rows={10} defaultValue="" />
      </div>
    </React.Fragment>
  );
}
