'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { Switch } from '@base-ui/react/switch';
import styles from './popup-tabbing.module.css';

function ExampleMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger openOnHover className={styles.Button}>
        Song <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.MenuPositioner} sideOffset={8}>
          <Menu.Popup className={styles.MenuPopup}>
            <Menu.Arrow className={styles.MenuArrow}>
              <ArrowSvg />
            </Menu.Arrow>
            <Menu.Item className={styles.MenuItem}>Add to Library</Menu.Item>
            <Menu.Item className={styles.MenuItem}>Add to Playlist</Menu.Item>
            <Menu.Separator className={styles.MenuSeparator} />
            <Menu.Item className={styles.MenuItem}>Play Next</Menu.Item>
            <Menu.Item className={styles.MenuItem}>Play Last</Menu.Item>
            <Menu.Separator className={styles.MenuSeparator} />
            <Menu.Item className={styles.MenuItem}>Favorite</Menu.Item>
            <Menu.Item className={styles.MenuItem}>Share</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ExamplePopoverInPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.Button}>Inner popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className={styles.PopoverPopupColumn}>
            <div className={styles.InnerTitle}>Inner content</div>
            <div className={styles.InnerDescription}>Try Tab / Shift+Tab out of here.</div>
            <button type="button" className={styles.Button}>
              Inner button
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const fruits = ['Apple', 'Banana', 'Orange', 'Grape', 'Mango', 'Strawberry'];

function ExampleCombobox() {
  const id = React.useId();

  return (
    <Combobox.Root items={fruits}>
      <div className={styles.ComboboxField}>
        <label htmlFor={id}>Choose a fruit</label>
        <div className={styles.ComboboxInputWrap}>
          <Combobox.Input placeholder="e.g. Apple" id={id} className={styles.ComboboxInput} />
          <div className={styles.ComboboxActions}>
            <Combobox.Trigger className={styles.ComboboxTriggerButton} aria-label="Open popup">
              <ChevronDownIcon className={styles.ComboboxIcon} />
            </Combobox.Trigger>
          </div>
        </div>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner className={styles.MenuPositioner} sideOffset={4}>
          <Combobox.Popup className={styles.ComboboxPopup}>
            <Combobox.Empty className={styles.ComboboxEmpty}>No fruits found.</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item} className={styles.ComboboxItem}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export default function PopupTabbing() {
  const [renderInsideButtons, setRenderInsideButtons] = React.useState(true);

  return (
    <div className={styles.Page}>
      <h1 className={styles.Title}>popup-tabbing</h1>
      <p className={styles.Description}>
        Repros for tab order and focus handoff between nested popups.
      </p>

      <label className={styles.SwitchLabel}>
        <Switch.Root
          checked={renderInsideButtons}
          onCheckedChange={setRenderInsideButtons}
          className={styles.SwitchRoot}
        >
          <Switch.Thumb className={styles.SwitchThumb} />
        </Switch.Root>
        Render inside before/after buttons
      </label>

      <div className={styles.Sections}>
        <section className={styles.Section}>
          <h2 className={styles.SectionTitle}>Combobox inside Popover</h2>
          <div className={styles.Row}>
            <button type="button" className={styles.Button}>
              Outside before
            </button>

            <Popover.Root>
              <Popover.Trigger className={styles.Button}>Outer popover</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8}>
                  <Popover.Popup className={styles.PopoverPopupColumn}>
                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside before
                      </button>
                    ) : null}

                    <ExampleCombobox />

                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside after
                      </button>
                    ) : null}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            <button type="button" className={styles.Button}>
              Outside after
            </button>
          </div>
        </section>

        <section className={styles.Section}>
          <h2 className={styles.SectionTitle}>Menu inside Popover</h2>
          <div className={styles.Row}>
            <button type="button" className={styles.Button}>
              Outside before
            </button>

            <Popover.Root>
              <Popover.Trigger className={styles.Button}>Outer popover</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8}>
                  <Popover.Popup className={styles.PopoverPopupRow}>
                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside before
                      </button>
                    ) : null}
                    <ExampleMenu />
                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside after
                      </button>
                    ) : null}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            <button type="button" className={styles.Button}>
              Outside after
            </button>
          </div>
        </section>

        <section className={styles.Section}>
          <h2 className={styles.SectionTitle}>Popover inside Popover</h2>
          <div className={styles.Row}>
            <button type="button" className={styles.Button}>
              Outside before
            </button>

            <Popover.Root>
              <Popover.Trigger className={styles.Button}>Outer popover</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8}>
                  <Popover.Popup className={styles.PopoverPopupColumn}>
                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside before
                      </button>
                    ) : null}
                    <ExamplePopoverInPopover />
                    {renderInsideButtons ? (
                      <button type="button" className={styles.Button}>
                        Inside after
                      </button>
                    ) : null}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            <button type="button" className={styles.Button}>
              Outside after
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowStrokeLight}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowStrokeDark}
      />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
