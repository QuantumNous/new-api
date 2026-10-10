'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Menubar } from '@base-ui/react/menubar';
import { SettingsMetadata, useExperimentSettings } from './_components/SettingsPanel';
import '../../../demo-data/theme/css-modules/theme.css';
import menuClasses from './menu/menu.module.css';
import classes from './menubar.module.css';

interface Settings {
  modal: boolean;
  loopFocus: boolean;
  orientation: 'horizontal' | 'vertical';
}

function getSubmenuPositionProps(parentOrientation: Menu.Root.Props['orientation']) {
  return {
    side: parentOrientation === 'horizontal' ? 'bottom' : 'right',
    align: 'start',
    sideOffset: 6,
  } as const;
}

export default function MenubarExperiment() {
  const { settings } = useExperimentSettings<Settings>();

  return (
    <div style={{ isolation: 'isolate' }}>
      <h1>Menubar</h1>
      <Menubar
        className={classes.Root}
        loopFocus={settings.loopFocus}
        orientation={settings.orientation}
        modal={settings.modal}
      >
        <Menu.Root>
          <Menu.Trigger className={classes.Item}>File</Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner
              className={menuClasses.Positioner}
              {...getSubmenuPositionProps(settings.orientation)}
            >
              <Menu.Popup className={menuClasses.Popup}>
                <Menu.Item className={menuClasses.Item}>Open…</Menu.Item>
                <Menu.Item className={menuClasses.Item}>Save</Menu.Item>
                <Menu.Item className={menuClasses.Item}>Save as…</Menu.Item>
                <Menu.Separator className={menuClasses.Separator} />

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={menuClasses.SubmenuTrigger}>
                    Share
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>

                  <Menu.Portal>
                    <Menu.Positioner className={menuClasses.Positioner} sideOffset={8}>
                      <Menu.Popup className={menuClasses.Popup}>
                        <Menu.Arrow className={menuClasses.Arrow}>
                          <ArrowIcon />
                        </Menu.Arrow>
                        <Menu.Item className={menuClasses.Item}>AirDrop</Menu.Item>
                        <Menu.Item className={menuClasses.Item}>Email link</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <Menu.Separator className={menuClasses.Separator} />
                <Menu.Item className={menuClasses.Item}>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger className={classes.Item}>Edit</Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner
              className={menuClasses.Positioner}
              {...getSubmenuPositionProps(settings.orientation)}
            >
              <Menu.Popup className={menuClasses.Popup}>
                <Menu.Item className={menuClasses.Item}>Cut</Menu.Item>
                <Menu.Item className={menuClasses.Item}>Copy</Menu.Item>
                <Menu.Item className={menuClasses.Item}>Paste</Menu.Item>

                <Menu.Separator className={menuClasses.Separator} />

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={menuClasses.SubmenuTrigger}>
                    Find on page
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>

                  <Menu.Portal>
                    <Menu.Positioner className={menuClasses.Positioner} sideOffset={8}>
                      <Menu.Popup className={menuClasses.Popup}>
                        <Menu.Item className={menuClasses.Item}>Find…</Menu.Item>
                        <Menu.Item className={menuClasses.Item}>Find next</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger className={classes.Item}>View</Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner
              className={menuClasses.Positioner}
              {...getSubmenuPositionProps(settings.orientation)}
            >
              <Menu.Popup className={menuClasses.Popup}>
                <Menu.RadioGroup value="light">
                  <Menu.RadioItem className={menuClasses.RadioItem} value="light">
                    <Menu.RadioItemIndicator className={menuClasses.RadioItemIndicator}>
                      <CheckIcon className={menuClasses.RadioItemIndicatorIcon} />
                    </Menu.RadioItemIndicator>
                    <span className={menuClasses.RadioItemText}>Light mode</span>
                  </Menu.RadioItem>
                  <Menu.RadioItem className={menuClasses.RadioItem} value="dark">
                    <Menu.RadioItemIndicator className={menuClasses.RadioItemIndicator}>
                      <CheckIcon className={menuClasses.RadioItemIndicatorIcon} />
                    </Menu.RadioItemIndicator>
                    <span className={menuClasses.RadioItemText}>Dark mode</span>
                  </Menu.RadioItem>
                </Menu.RadioGroup>

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={menuClasses.SubmenuTrigger}>
                    Layout
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>

                  <Menu.Portal>
                    <Menu.Positioner className={menuClasses.Positioner} sideOffset={8}>
                      <Menu.Popup className={menuClasses.Popup}>
                        <Menu.RadioGroup defaultValue="light">
                          <Menu.RadioItem className={menuClasses.RadioItem} value="light">
                            <Menu.RadioItemIndicator className={menuClasses.RadioItemIndicator}>
                              <CheckIcon className={menuClasses.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={menuClasses.RadioItemText}>Single column</span>
                          </Menu.RadioItem>
                          <Menu.RadioItem className={menuClasses.RadioItem} value="dark">
                            <Menu.RadioItemIndicator className={menuClasses.RadioItemIndicator}>
                              <CheckIcon className={menuClasses.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={menuClasses.RadioItemText}>Multiple columns</span>
                          </Menu.RadioItem>
                        </Menu.RadioGroup>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Menu.Root disabled>
          <Menu.Trigger className={classes.Item}>Develop</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              className={menuClasses.Positioner}
              {...getSubmenuPositionProps(settings.orientation)}
            >
              <Menu.Popup className={menuClasses.Popup}>
                <Menu.Item className={menuClasses.Item}>This should not appear</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menubar>
      <hr className={classes.Separator} />
      <input className={classes.Input} placeholder="focus tester" />
    </div>
  );
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  loopFocus: {
    type: 'boolean',
    label: 'Focus loop',
    default: true,
  },
  modal: {
    type: 'boolean',
    label: 'Modal',
    default: true,
  },
  orientation: {
    type: 'string',
    label: 'Orientation',
    options: ['horizontal', 'vertical'],
    default: 'horizontal',
  },
};

function ChevronRightIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M3.5 9L7.5 5L3.5 1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={menuClasses.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={menuClasses.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={menuClasses.ArrowInnerStroke}
      />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}
