'use client';
import * as React from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { Switch } from '@base-ui/react/switch';
import { NumberField } from '@base-ui/react/number-field';
import { Slider } from '@base-ui/react/slider';
import { Tooltip } from '@base-ui/react/tooltip';
import { Popover } from '@base-ui/react/popover';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Menu } from '@base-ui/react/menu';
import toolbarClasses from './toolbar.module.css';
import triggerToolbarClasses from './triggers.module.css';
import menuClasses from '../../../(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import tooltipClasses from '../../../(docs)/react/components/tooltip/demos/hero/css-modules/index.module.css';
import switchClasses from '../../../(docs)/react/components/switch/demos/hero/css-modules/index.module.css';
import dialogClasses from '../../../(docs)/react/components/alert-dialog/demos/hero/css-modules/index.module.css';
import popoverClasses from '../../../(docs)/react/components/popover/demos/_index.module.css';
import comboSliderClasses from './slider.module.css';
import {
  SlidersIcon,
  TrashIcon,
  MessageCircleIcon,
  ArrowSvg,
  BellIcon,
  MoreHorizontalIcon,
  ChevronRightIcon,
} from './_icons';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';

interface Settings extends Record<string, boolean> {}

export const settingsMetadata: SettingsMetadata<Settings> = {
  verticalOrientation: {
    type: 'boolean',
    label: 'Vertical',
    default: false,
  },
  dialogDisabled: {
    type: 'boolean',
    label: 'Dialog disabled',
  },
  interactivePopoverDisabled: {
    type: 'boolean',
    label: 'Popover (interactive) disabled',
  },
  popoverDisabled: {
    type: 'boolean',
    label: 'Popover disabled',
  },
  alertDialogDisabled: {
    type: 'boolean',
    label: 'Alert Dialog disabled',
  },
  switchDisabled: {
    type: 'boolean',
    label: 'Switch disabled',
    default: false,
  },
  toolbarDisabled: {
    type: 'boolean',
    label: 'Everything disabled',
    default: false,
  },
};

const styles = {
  demo: triggerToolbarClasses,
  toolbar: toolbarClasses,
  switch: switchClasses,
  dialog: dialogClasses,
  popover: popoverClasses,
  slider: comboSliderClasses,
  tooltip: tooltipClasses,
  menu: menuClasses,
};

const TEXT = `Shows toolbar buttons as various triggers:
- Menu.Trigger
- Dialog.Trigger / AlertDialog.Trigger
- Popover.Trigger
- Tooltip.Trigger
- and a Switch
`;

function classNames(...c: Array<string | undefined | null | false>) {
  return c.filter(Boolean).join(' ');
}

function renderTriggerWithTooltip(args: {
  render: any;
  key: string;
  label: string;
  disabled?: boolean;
}) {
  const { render, key, label, disabled = false } = args;
  return (
    <Tooltip.Root key={key}>
      <Tooltip.Trigger
        render={
          <Toolbar.Button
            className={classNames(styles.toolbar.Toggle, styles.demo.Toggle)}
            disabled={disabled}
            render={render}
          />
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
  const DIALOG_DISABLED = settings.dialogDisabled || settings.toolbarDisabled;
  const ALERT_DIALOG_DISABLED = settings.alertDialogDisabled || settings.toolbarDisabled;
  const POPOVER_DISABLED = settings.popoverDisabled || settings.toolbarDisabled;
  const INT_POPOVER_DISABLED = settings.interactivePopoverDisabled || settings.toolbarDisabled;
  const SWITCH_DISABLED = settings.switchDisabled || settings.toolbarDisabled;
  const MENU_DISABLED = settings.menuDisabled || settings.toolbarDisabled;
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
        <Toolbar.Root
          className={classNames(styles.toolbar.Root, styles.demo.Root)}
          orientation={settings.verticalOrientation ? 'vertical' : 'horizontal'}
        >
          <Menu.Root>
            {renderTriggerWithTooltip({
              render: (
                <Menu.Trigger>
                  <MoreHorizontalIcon className={styles.toolbar.Icon} />
                </Menu.Trigger>
              ),
              key: 'menu',
              label: 'More actions',
              disabled: MENU_DISABLED,
            })}

            <Menu.Portal keepMounted>
              <Menu.Positioner className={styles.menu.Positioner}>
                <Menu.Popup className={styles.menu.Popup}>
                  <Menu.Item className={styles.menu.Item}>Save</Menu.Item>
                  <Menu.Item className={styles.menu.Item}>Save as…</Menu.Item>
                  <Menu.Separator className={styles.menu.Separator} />
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger className={styles.menu.SubmenuTrigger}>
                      Recent
                      <ChevronRightIcon />
                    </Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner className={styles.menu.Positioner}>
                        <Menu.Popup className={styles.menu.Popup}>
                          <Menu.Item className={styles.menu.Item}>index.tsx</Menu.Item>
                          <Menu.Item className={styles.menu.Item}>index.module.css</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <Menu.Separator className={styles.menu.Separator} />
                  <Menu.Item className={styles.menu.Item}>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          <Toolbar.Separator className={styles.demo.Separator} />

          <Dialog.Root>
            {renderTriggerWithTooltip({
              render: (
                <Dialog.Trigger>
                  <MessageCircleIcon className={styles.toolbar.Icon} />
                </Dialog.Trigger>
              ),
              key: 'comment-dialog',
              label: 'Add a comment',
              disabled: DIALOG_DISABLED,
            })}

            <Dialog.Portal keepMounted>
              <Dialog.Backdrop className={styles.dialog.Backdrop} />
              <Dialog.Popup className={styles.dialog.Popup}>
                <Dialog.Title className={styles.dialog.Title}>Write a comment</Dialog.Title>
                <textarea name="" id="" className={styles.toolbar.Textarea} />
                <div className={styles.dialog.Actions}>
                  <Dialog.Close data-color="red" className={styles.dialog.Button}>
                    Close
                  </Dialog.Close>
                  <Dialog.Close className={styles.dialog.Button}>Submit</Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>

          <Toolbar.Separator className={styles.demo.Separator} />

          <Popover.Root>
            <Tooltip.Root>
              {renderTriggerWithTooltip({
                render: (
                  <Popover.Trigger>
                    <SlidersIcon aria-label="RGB color picker" className={styles.popover.Icon} />
                  </Popover.Trigger>
                ),
                key: 'rgb-color-picker',
                label: 'RGB color picker',
                disabled: INT_POPOVER_DISABLED,
              })}
            </Tooltip.Root>

            <Popover.Portal>
              <Popover.Positioner sideOffset={8}>
                <Popover.Popup className={styles.popover.Popup}>
                  <Popover.Arrow className={styles.popover.Arrow}>
                    <ArrowSvg />
                  </Popover.Arrow>
                  <Popover.Title className={styles.popover.Title} style={{ marginBottom: '1rem' }}>
                    RGB Color Picker
                  </Popover.Title>
                  <ComboSlider color="r" />
                  <ComboSlider color="g" />
                  <ComboSlider color="b" />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>

          <Toolbar.Separator className={styles.demo.Separator} />

          <Popover.Root>
            {renderTriggerWithTooltip({
              render: (
                <Popover.Trigger>
                  <BellIcon aria-label="Notifications" className={styles.popover.Icon} />
                </Popover.Trigger>
              ),
              key: 'notifications',
              label: 'Notifications',
              disabled: POPOVER_DISABLED,
            })}

            <Popover.Portal>
              <Popover.Positioner sideOffset={8}>
                <Popover.Popup className={styles.popover.Popup}>
                  <Popover.Arrow className={styles.popover.Arrow}>
                    <ArrowSvg />
                  </Popover.Arrow>
                  <Popover.Title className={styles.popover.Title}>Notifications</Popover.Title>
                  <Popover.Description className={styles.popover.Description}>
                    You are all caught up. Good job!
                  </Popover.Description>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>

          <Toolbar.Separator className={styles.demo.Separator} />

          <AlertDialog.Root>
            {renderTriggerWithTooltip({
              render: (
                <AlertDialog.Trigger>
                  <TrashIcon className={styles.toolbar.Icon} />
                </AlertDialog.Trigger>
              ),
              key: 'delete',
              label: 'Delete',
              disabled: ALERT_DIALOG_DISABLED,
            })}

            <AlertDialog.Portal keepMounted>
              <AlertDialog.Backdrop className={styles.dialog.Backdrop} />
              <AlertDialog.Popup className={styles.dialog.Popup}>
                <AlertDialog.Title className={styles.dialog.Title}>
                  Delete everything
                </AlertDialog.Title>
                <AlertDialog.Description className={styles.dialog.Description}>
                  Are you sure? You cannot undo this.
                </AlertDialog.Description>
                <div className={styles.dialog.Actions}>
                  <AlertDialog.Close className={styles.dialog.Button}>No, Cancel</AlertDialog.Close>
                  <AlertDialog.Close data-color="red" className={styles.dialog.Button}>
                    Yes, Delete
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>

          <Toolbar.Separator className={styles.demo.Separator} />

          <Toolbar.Button
            disabled={SWITCH_DISABLED}
            className={classNames(styles.toolbar.Toggle, styles.demo.Toggle, styles.demo.Switch)}
            render={
              <Switch.Root defaultChecked className={styles.switch.Switch}>
                <Switch.Thumb className={styles.switch.Thumb} style={{ marginRight: 'auto' }} />
              </Switch.Root>
            }
          />
        </Toolbar.Root>

        <textarea className={styles.toolbar.Textarea} name="" id="" rows={8} defaultValue={TEXT} />
      </div>
    </React.Fragment>
  );
}

function ComboSlider({ color }: { color: 'r' | 'g' | 'b' }) {
  const id = React.useId();
  const [val, setVal] = React.useState(20);
  return (
    <div className={styles.slider.Row}>
      <Slider.Root
        value={val}
        onValueChange={(newValue, eventDetails) => {
          if (color === 'r') {
            eventDetails.event.preventDefault();
          }
          setVal(newValue as number);
        }}
        className={styles.slider.Slider}
        min={0}
        max={255}
      >
        <Slider.Value className={styles.slider.Value} />
        <Slider.Control className={styles.slider.Control}>
          <Slider.Track className={styles.slider.Track}>
            <Slider.Indicator
              className={classNames(styles.slider.Indicator, styles.slider[color])}
            />
            <Slider.Thumb className={styles.slider.Thumb} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <NumberField.Root
        id={id}
        value={val}
        onValueChange={(newValue) => {
          if (newValue != null) {
            setVal(newValue);
          }
        }}
        className={styles.slider.Field}
      >
        <NumberField.Group className={styles.slider.Group}>
          <NumberField.Input className={styles.slider.Input} />
        </NumberField.Group>
      </NumberField.Root>
    </div>
  );
}
