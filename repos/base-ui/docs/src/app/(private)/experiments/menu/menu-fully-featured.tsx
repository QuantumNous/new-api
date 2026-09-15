'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import clsx from 'clsx';
import NextLink from 'next/link';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import '../../../../demo-data/theme/css-modules/theme.css';
import classes from './menu.module.css';

interface Settings {
  customAnchor: boolean;
  modal: boolean;
  openOnHover: boolean;
  disabled: boolean;
  customTriggerElement: boolean;
  side: Menu.Positioner.Props['side'];
  align: Menu.Positioner.Props['align'];
}

export default function MenuFullyFeatured() {
  const { settings } = useExperimentSettings<Settings>();

  const anchorRef = React.useRef<HTMLDivElement>(null);

  const triggerRender = React.useMemo(
    () => (settings.customTriggerElement ? <span /> : undefined),
    [settings.customTriggerElement],
  );

  const handleItemClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    console.log(`${event.currentTarget.textContent} clicked`);
  }, []);

  return (
    <div>
      <h1>Fully featured menu</h1>
      <Menu.Root modal={settings.modal} disabled={settings.disabled}>
        <Menu.Trigger
          className={classes.Button}
          render={triggerRender}
          nativeButton={triggerRender === undefined}
          openOnHover={settings.openOnHover}
        >
          Menu <ChevronDownIcon className={classes.ButtonIcon} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className={classes.Positioner}
            sideOffset={8}
            anchor={settings.customAnchor ? anchorRef : undefined}
            side={settings.side}
            align={settings.align}
          >
            <Menu.Popup className={classes.Popup}>
              <Menu.Arrow className={classes.Arrow}>
                <ArrowIcon />
              </Menu.Arrow>
              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                Item 1
              </Menu.Item>
              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                Item 2
              </Menu.Item>
              <Menu.LinkItem
                href="https://base-ui.com"
                className={clsx(classes.Item, classes.LinkItem)}
              >
                Link 1 (base-ui.com)
              </Menu.LinkItem>
              <Menu.LinkItem
                render={<a href="https://github.com">Link 2 (github.com)</a>}
                className={clsx(classes.Item, classes.LinkItem)}
              />
              <Menu.LinkItem
                render={<NextLink href="/experiments">Link 3 (/experiments)</NextLink>}
                className={clsx(classes.Item, classes.LinkItem)}
              />
              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                Item 3
              </Menu.Item>
              <Menu.Separator className={classes.Separator} />
              <Menu.Item className={classes.Item} closeOnClick={false} onClick={handleItemClick}>
                Item (close on click disabled)
              </Menu.Item>
              <Menu.Item className={classes.Item} disabled onClick={handleItemClick}>
                Disabled Item
              </Menu.Item>
              <Menu.Separator className={classes.Separator} />

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger className={classes.SubmenuTrigger}>
                  Nested menu
                  <ChevronRightIcon />
                </Menu.SubmenuTrigger>

                <Menu.Portal>
                  <Menu.Positioner className={classes.Positioner} sideOffset={8}>
                    <Menu.Popup className={classes.Popup}>
                      <div className={classes.NonFocusableText}>Non-focusable text</div>
                      <Menu.Group>
                        <Menu.GroupLabel className={classes.GroupLabel}>
                          Radio items
                        </Menu.GroupLabel>
                        <Menu.RadioGroup>
                          <Menu.RadioItem className={classes.RadioItem} value="o1">
                            <Menu.RadioItemIndicator className={classes.RadioItemIndicator}>
                              <CheckIcon className={classes.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={classes.RadioItemText}>Option 1</span>
                          </Menu.RadioItem>
                          <Menu.RadioItem className={classes.RadioItem} value="o2">
                            <Menu.RadioItemIndicator className={classes.RadioItemIndicator}>
                              <CheckIcon className={classes.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={classes.RadioItemText}>Option 2</span>
                          </Menu.RadioItem>
                          <Menu.RadioItem className={classes.RadioItem} value="o3" closeOnClick>
                            <Menu.RadioItemIndicator className={classes.RadioItemIndicator}>
                              <CheckIcon className={classes.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={classes.RadioItemText}>Option 3 (close on click)</span>
                          </Menu.RadioItem>
                          <Menu.RadioItem className={classes.RadioItem} value="o4" disabled>
                            <Menu.RadioItemIndicator className={classes.RadioItemIndicator}>
                              <CheckIcon className={classes.RadioItemIndicatorIcon} />
                            </Menu.RadioItemIndicator>
                            <span className={classes.RadioItemText}>Disabled option</span>
                          </Menu.RadioItem>
                        </Menu.RadioGroup>
                      </Menu.Group>

                      <Menu.Separator className={classes.Separator} />

                      <Menu.Group>
                        <Menu.GroupLabel className={classes.GroupLabel}>
                          Checkbox Items
                        </Menu.GroupLabel>
                        <Menu.CheckboxItem className={classes.CheckboxItem}>
                          <Menu.CheckboxItemIndicator className={classes.CheckboxItemIndicator}>
                            <CheckIcon className={classes.CheckboxItemIndicatorIcon} />
                          </Menu.CheckboxItemIndicator>
                          <span className={classes.CheckboxItemText}>Option A</span>
                        </Menu.CheckboxItem>
                        <Menu.CheckboxItem className={classes.CheckboxItem}>
                          <Menu.CheckboxItemIndicator className={classes.CheckboxItemIndicator}>
                            <CheckIcon className={classes.CheckboxItemIndicatorIcon} />
                          </Menu.CheckboxItemIndicator>
                          <span className={classes.CheckboxItemText}>Option B</span>
                        </Menu.CheckboxItem>
                        <Menu.CheckboxItem className={classes.CheckboxItem} closeOnClick>
                          <Menu.CheckboxItemIndicator className={classes.CheckboxItemIndicator}>
                            <CheckIcon className={classes.CheckboxItemIndicatorIcon} />
                          </Menu.CheckboxItemIndicator>
                          <span className={classes.CheckboxItemText}>
                            Option C (close on click)
                          </span>
                        </Menu.CheckboxItem>
                        <Menu.CheckboxItem className={classes.CheckboxItem} disabled>
                          <Menu.CheckboxItemIndicator className={classes.CheckboxItemIndicator}>
                            <CheckIcon className={classes.CheckboxItemIndicatorIcon} />
                          </Menu.CheckboxItemIndicator>
                          <span className={classes.CheckboxItemText}>Disabled option</span>
                        </Menu.CheckboxItem>
                      </Menu.Group>

                      <Menu.Separator className={classes.Separator} />

                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger className={classes.SubmenuTrigger}>
                          Nested menu
                          <ChevronRightIcon />
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner className={classes.Positioner} sideOffset={8}>
                            <Menu.Popup className={classes.Popup}>
                              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                                Submenu item 1
                              </Menu.Item>
                              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                                Submenu item 2
                              </Menu.Item>
                              <Menu.Item className={classes.Item} onClick={handleItemClick}>
                                Submenu item 3
                              </Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger className={classes.SubmenuTrigger}>
                  Adjacent nested menu
                  <ChevronRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner className={classes.Positioner} sideOffset={8}>
                    <Menu.Popup className={classes.Popup}>
                      <Menu.Item className={classes.Item}>Item 1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.SubmenuRoot disabled>
                <Menu.SubmenuTrigger className={classes.SubmenuTrigger}>
                  Disabled nested menu
                  <ChevronRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner className={classes.Positioner} sideOffset={8}>
                    <Menu.Popup className={classes.Popup}>
                      <Menu.Item className={classes.Item}>This should not appear</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {settings.customAnchor && (
        <div className={classes.CustomAnchor} ref={anchorRef}>
          Menu will be anchored here
        </div>
      )}
    </div>
  );
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  customAnchor: {
    type: 'boolean',
    label: 'Custom anchor',
  },
  modal: {
    type: 'boolean',
    label: 'Modal',
    default: true,
  },
  openOnHover: {
    type: 'boolean',
    label: 'Open on hover',
  },
  disabled: {
    type: 'boolean',
    label: 'Disabled',
  },
  customTriggerElement: {
    type: 'boolean',
    label: 'Trigger as <span>',
  },
  side: {
    type: 'string',
    label: 'Side',
    options: ['top', 'right', 'bottom', 'left'],
    default: 'bottom',
  },
  align: {
    type: 'string',
    label: 'Align',
    options: ['start', 'center', 'end'],
    default: 'center',
  },
};

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

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
        className={classes.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={classes.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={classes.ArrowInnerStroke}
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
