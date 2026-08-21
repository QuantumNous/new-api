'use client';
import { Menu } from '@base-ui/react/menu';
import { Dialog } from '@base-ui/react/dialog';
import styles from './menu.module.css';

export default function MenuComplexNestingExperiment() {
  return (
    <div className={styles.ExperimentRoot}>
      <h1 className={styles.ExperimentTitle}>Menu Complex Nesting Experiments</h1>
      <p className={styles.ExperimentDescription}>
        Testing how independent menus work when nested in React tree through dialogs and other
        components.
      </p>

      <section className={styles.Section}>
        <h2 className={styles.SectionTitle}>1. Menu → Item → Dialog → Menu</h2>
        <p className={styles.SectionDescription}>
          Click the menu button, select "Open Settings", then use the menu inside the dialog. The
          dialog is opened from within a menu item.
        </p>

        <Menu.Root>
          <Menu.Trigger className={styles.Button}>Main Menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className={styles.Positioner}>
              <Menu.Popup className={styles.Popup}>
                <Menu.Item className={styles.Item}>New File</Menu.Item>
                <Menu.Item className={styles.Item}>Save</Menu.Item>

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                    Export
                    <ChevronRightIcon />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                      <Menu.Popup className={styles.Popup}>
                        <Menu.Item className={styles.Item}>Export as PDF</Menu.Item>
                        <Menu.Item className={styles.Item}>Export as PNG</Menu.Item>
                        <Menu.Item className={styles.Item}>Export as SVG</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <Menu.Separator className={styles.Separator} />

                <Dialog.Root>
                  <Menu.Item
                    render={<Dialog.Trigger />}
                    className={styles.Item}
                    closeOnClick={false}
                    nativeButton
                  >
                    Open Settings
                  </Menu.Item>

                  <Dialog.Portal>
                    <Dialog.Backdrop className={styles.DialogBackdrop} />
                    <Dialog.Popup className={styles.DialogPopup}>
                      <Dialog.Title className={styles.DialogTitle}>
                        Settings (Nested Dialog)
                      </Dialog.Title>

                      <div className={styles.DialogBody}>
                        <p className={styles.DialogDescription}>
                          This dialog is nested within the menu popup. It contains an independent
                          menu.
                        </p>

                        {/* Menu nested within Dialog which is nested within Menu */}
                        <div className={styles.Card}>
                          <h3 className={styles.CardTitle}>Theme Settings</h3>
                          <Menu.Root>
                            <Menu.Trigger className={styles.Button}>Theme Options</Menu.Trigger>
                            <Menu.Portal>
                              <Menu.Positioner className={styles.Positioner}>
                                <Menu.Popup className={styles.Popup}>
                                  <Menu.Item className={styles.Item}>Light Theme</Menu.Item>
                                  <Menu.Item className={styles.Item}>Dark Theme</Menu.Item>

                                  <Menu.SubmenuRoot>
                                    <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                                      Advanced
                                      <ChevronRightIcon />
                                    </Menu.SubmenuTrigger>
                                    <Menu.Portal>
                                      <Menu.Positioner className={styles.Positioner} sideOffset={4}>
                                        <Menu.Popup className={styles.Popup}>
                                          <Menu.Item className={styles.Item}>
                                            Custom Colors
                                          </Menu.Item>
                                          <Menu.Item className={styles.Item}>
                                            Font Settings
                                          </Menu.Item>
                                          <Menu.Separator className={styles.Separator} />
                                          <Menu.Item className={styles.Item}>
                                            Reset to Default
                                          </Menu.Item>
                                        </Menu.Popup>
                                      </Menu.Positioner>
                                    </Menu.Portal>
                                  </Menu.SubmenuRoot>

                                  <Menu.Separator className={styles.Separator} />
                                  <Menu.Item className={styles.Item}>Auto Theme</Menu.Item>
                                </Menu.Popup>
                              </Menu.Positioner>
                            </Menu.Portal>
                          </Menu.Root>
                        </div>

                        <div className={styles.DialogActions}>
                          <Dialog.Close className={styles.DialogCancel}>Cancel</Dialog.Close>
                          <Dialog.Close className={styles.DialogConfirm}>Save</Dialog.Close>
                        </div>
                      </div>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
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
