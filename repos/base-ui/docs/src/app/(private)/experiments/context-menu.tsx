'use client';
import * as React from 'react';
import clsx from 'clsx';
import { ContextMenu } from '@base-ui/react/context-menu';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import styles from './context-menu.module.css';

export default function ContextMenuExperiment() {
  const [disabled, setDisabled] = React.useState(false);

  return (
    <div className={styles.Root}>
      <h1 className={styles.Title}>Context Menu Experiments</h1>

      {/* Scenario 1: Context menu within a context menu trigger */}
      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>1. Context Menu within Context Menu Trigger</h2>
        <p className={styles.Description}>
          Right-click on the outer box, then right-click on the inner box to see nested context
          menus.
        </p>

        <ContextMenu.Root>
          <ContextMenu.Trigger className={clsx(styles.ContextBox, styles.Blue)}>
            <div className={styles.CenterText}>
              <span className={clsx(styles.LabelPrimary, styles.BluePrimary)}>
                Outer Context Menu
              </span>
              <span className={clsx(styles.LabelSecondary, styles.BlueSecondary)}>
                Right-click me
              </span>

              <ContextMenu.Root>
                <ContextMenu.Trigger className={clsx(styles.ContextBoxInner, styles.Red)}>
                  <span className={clsx(styles.LabelPrimary, styles.RedPrimary)}>
                    Inner Context Menu
                  </span>
                  <span className={clsx(styles.LabelSecondary, styles.RedSecondary)}>
                    Right-click me too!
                  </span>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Positioner className={styles.Positioner}>
                    <ContextMenu.Popup className={styles.Popup180}>
                      <ContextMenu.Item className={styles.Item}>Inner Action 1</ContextMenu.Item>
                      <ContextMenu.Item className={styles.Item}>Inner Action 2</ContextMenu.Item>
                      <ContextMenu.Separator className={styles.Separator} />
                      <ContextMenu.Item className={styles.Item}>Inner Delete</ContextMenu.Item>
                    </ContextMenu.Popup>
                  </ContextMenu.Positioner>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className={styles.Positioner}>
              <ContextMenu.Popup className={styles.Popup180}>
                <ContextMenu.Item className={styles.Item}>Outer Action 1</ContextMenu.Item>
                <ContextMenu.Item className={styles.Item}>Outer Action 2</ContextMenu.Item>
                <ContextMenu.Separator className={styles.Separator} />
                <ContextMenu.Item className={styles.Item}>Outer Delete</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </section>

      {/* Scenario 2: Context menu within context menu trigger, both with submenus */}
      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>2. Nested Context Menus with Submenus</h2>
        <p className={styles.Description}>
          Right-click on either box and explore the submenu options.
        </p>

        <ContextMenu.Root>
          <ContextMenu.Trigger className={clsx(styles.ContextBox, styles.Green)}>
            <div className={styles.CenterText}>
              <span className={clsx(styles.LabelPrimary, styles.GreenPrimary)}>
                Outer Context Menu with Submenu
              </span>
              <span className={clsx(styles.LabelSecondary, styles.GreenSecondary)}>
                Right-click me
              </span>

              <ContextMenu.Root>
                <ContextMenu.Trigger className={clsx(styles.ContextBoxInner, styles.Purple)}>
                  <span className={clsx(styles.LabelPrimary, styles.PurplePrimary)}>
                    Inner Context Menu with Submenu
                  </span>
                  <span className={clsx(styles.LabelSecondary, styles.PurpleSecondary)}>
                    Right-click me too!
                  </span>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Positioner className={styles.Positioner}>
                    <ContextMenu.Popup className={styles.Popup180}>
                      <ContextMenu.Item className={styles.Item}>
                        Inner Basic Action
                      </ContextMenu.Item>

                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                          Inner Submenu
                          <ChevronRightIcon />
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                            <Menu.Popup className={styles.Popup160}>
                              <Menu.Item className={styles.Item}>Inner Sub Action 1</Menu.Item>
                              <Menu.Item className={styles.Item}>Inner Sub Action 2</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>

                      <ContextMenu.Separator className={styles.Separator} />
                      <ContextMenu.Item className={styles.Item}>Inner Delete</ContextMenu.Item>
                    </ContextMenu.Popup>
                  </ContextMenu.Positioner>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className={styles.Positioner}>
              <ContextMenu.Popup className={styles.Popup180}>
                <ContextMenu.Item className={styles.Item}>Outer Basic Action</ContextMenu.Item>

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                    Outer Submenu
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                      <Menu.Popup className={styles.Popup160}>
                        <Menu.Item className={styles.Item}>Outer Sub Action 1</Menu.Item>
                        <Menu.Item className={styles.Item}>Outer Sub Action 2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <ContextMenu.Separator className={styles.Separator} />
                <ContextMenu.Item className={styles.Item}>Outer Delete</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </section>

      {/* Scenario 3: Context menu within context menu popup item, both with submenus */}
      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>3. Context Menu within Context Menu Popup Item</h2>
        <p className={styles.Description}>
          Right-click on the box, then right-click on the "Special Item" in the popup.
        </p>

        <ContextMenu.Root>
          <ContextMenu.Trigger className={clsx(styles.ContextBox, styles.Orange)}>
            <div className={styles.CenterText}>
              <span className={clsx(styles.LabelPrimary, styles.OrangePrimary)}>
                Complex Context Menu
              </span>
              <span className={clsx(styles.LabelSecondary, styles.OrangeSecondary)}>
                Right-click me, then right-click "Special Item"
              </span>
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className={styles.Positioner}>
              <ContextMenu.Popup className={styles.Popup180}>
                <ContextMenu.Item className={styles.Item}>Regular Action</ContextMenu.Item>

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                    Main Submenu
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                      <Menu.Popup className={styles.Popup160}>
                        <Menu.Item className={styles.Item}>Sub Action 1</Menu.Item>
                        <Menu.Item className={styles.Item}>Sub Action 2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <ContextMenu.Separator className={styles.Separator} />

                {/* Context menu within popup item */}
                <ContextMenu.Root>
                  <ContextMenu.Trigger className={styles.SpecialTrigger}>
                    Special Item (right-click me!)
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Positioner className={styles.Positioner}>
                      <ContextMenu.Popup className={styles.Popup180}>
                        <ContextMenu.Item className={styles.Item}>Nested Action 1</ContextMenu.Item>

                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                            Nested Submenu
                            <ChevronRightIcon />
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                              <Menu.Popup className={styles.Popup160}>
                                <Menu.Item className={styles.Item}>Deep Action 1</Menu.Item>
                                <Menu.Item className={styles.Item}>Deep Action 2</Menu.Item>
                                <Menu.Separator className={styles.Separator} />
                                <Menu.Item className={clsx(styles.Item, styles.ItemDanger)}>
                                  Deep Delete
                                </Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>

                        <ContextMenu.Separator className={styles.Separator} />
                        <ContextMenu.Item className={clsx(styles.Item, styles.ItemDanger)}>
                          Nested Delete
                        </ContextMenu.Item>
                      </ContextMenu.Popup>
                    </ContextMenu.Positioner>
                  </ContextMenu.Portal>
                </ContextMenu.Root>

                <ContextMenu.Separator className={styles.Separator} />
                <ContextMenu.Item className={clsx(styles.Item, styles.ItemDanger)}>
                  Delete
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </section>

      {/* Scenario 4: [FINAL BOSS ⚔️] Nested context menu with a menu inside */}
      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>
          4. [FINAL BOSS ⚔️] Nested context menus, popover with a menu and a context menu inside
        </h2>
        <p className={styles.Description}>
          Right-click the outer box, then right-click the inner box. Inside the inner context menu,
          open the popover, then open the menu inside the popover, then right-click the context menu
          inside the popover.
        </p>

        <ContextMenu.Root>
          <ContextMenu.Trigger className={clsx(styles.ContextBox, styles.Cyan)}>
            <div className={styles.CenterText}>
              <span className={clsx(styles.LabelPrimary, styles.CyanPrimary)}>
                Outer Context Menu
              </span>
              <span className={clsx(styles.LabelSecondary, styles.CyanSecondary)}>
                Right-click me
              </span>

              <ContextMenu.Root>
                <ContextMenu.Trigger
                  className={clsx(styles.ContextBox, styles.Cyan, styles.ContextBoxCenter)}
                >
                  <div className={styles.CenterText}>
                    <span className={clsx(styles.LabelPrimary, styles.CyanPrimary)}>
                      Inner Context Menu
                    </span>
                    <span className={clsx(styles.LabelSecondary, styles.CyanSecondary)}>
                      Right-click me
                    </span>

                    <Popover.Root>
                      <Popover.Trigger className={styles.PopoverTrigger}>
                        Open popover
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Positioner sideOffset={8}>
                          <Popover.Popup className={styles.PopoverPopup}>
                            <div className={styles.PopoverPopupBody}>
                              <Menu.Root>
                                <Menu.Trigger className={styles.MenuTrigger}>
                                  Open Actions Menu
                                </Menu.Trigger>
                                <Menu.Portal>
                                  <Menu.Positioner className={styles.Positioner} side="top">
                                    <Menu.Popup className={styles.Popup180}>
                                      <Menu.Item className={styles.Item}>Menu Action</Menu.Item>
                                    </Menu.Popup>
                                  </Menu.Positioner>
                                </Menu.Portal>
                              </Menu.Root>

                              <ContextMenu.Root>
                                <ContextMenu.Trigger className={styles.InlineContextTrigger}>
                                  <span className={clsx(styles.LabelPrimary, styles.RedPrimary)}>
                                    Popover Context Menu
                                  </span>
                                  <span
                                    className={clsx(styles.LabelSecondary, styles.RedSecondary)}
                                  >
                                    Right-click me!
                                  </span>
                                </ContextMenu.Trigger>
                                <ContextMenu.Portal>
                                  <ContextMenu.Positioner className={styles.Positioner}>
                                    <ContextMenu.Popup className={styles.Popup180}>
                                      <ContextMenu.Item className={styles.Item}>
                                        Popover context Action 1
                                      </ContextMenu.Item>
                                    </ContextMenu.Popup>
                                  </ContextMenu.Positioner>
                                </ContextMenu.Portal>
                              </ContextMenu.Root>
                            </div>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Positioner className={styles.Positioner}>
                    <ContextMenu.Popup className={styles.Popup220}>
                      <ContextMenu.Item className={styles.Item}>Inner Action</ContextMenu.Item>
                    </ContextMenu.Popup>
                  </ContextMenu.Positioner>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className={styles.Positioner}>
              <ContextMenu.Popup className={styles.Popup220}>
                <ContextMenu.Item className={styles.Item}>Outer Action</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </section>

      {/* Scenario 5: Disabled context menu */}
      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>5. Disabled Context Menu</h2>
        <p className={styles.Description}>
          Toggle the checkbox to disable the context menu. When disabled, right-clicking will not
          open the menu.
        </p>

        <label className={styles.DisabledToggle}>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
            className={styles.DisabledCheckbox}
          />
          <span className={styles.DisabledLabel}>Disable context menu</span>
        </label>

        <ContextMenu.Root disabled={disabled}>
          <ContextMenu.Trigger className={clsx(styles.ContextBox, styles.Indigo)}>
            <div className={styles.CenterText}>
              <span
                className={clsx(
                  styles.LabelPrimary,
                  disabled ? styles.DisabledTextMuted : styles.DisabledTextActive,
                )}
              >
                Right-click here
              </span>
              <span
                className={clsx(
                  styles.LabelSecondary,
                  disabled ? styles.DisabledHintMuted : styles.DisabledHintActive,
                )}
              >
                {disabled ? 'Context menu is disabled' : 'Context menu will open on right-click'}
              </span>
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className={styles.Positioner}>
              <ContextMenu.Popup className={styles.Popup180}>
                <ContextMenu.Item className={styles.Item}>Cut</ContextMenu.Item>
                <ContextMenu.Item className={styles.Item}>Copy</ContextMenu.Item>
                <ContextMenu.Item className={styles.Item}>Paste</ContextMenu.Item>
                <ContextMenu.Separator className={styles.Separator} />
                <ContextMenu.Item className={styles.Item}>Select All</ContextMenu.Item>
                <ContextMenu.Separator className={styles.Separator} />
                <ContextMenu.Item className={clsx(styles.Item, styles.ItemDanger)}>
                  Delete
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </section>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 9L7.5 5L3.5 1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
