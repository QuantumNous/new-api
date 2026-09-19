'use client';
import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

export default function ExampleDrawerNested() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className={styles.Button}>Open drawer stack</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup className={styles.Popup}>
            <div className={styles.Handle} />
            <Drawer.Content className={styles.Content}>
              <Drawer.Title className={styles.Title}>Account</Drawer.Title>
              <Drawer.Description className={styles.Description}>
                Nested drawers can be styled to stack, while each drawer remains independently focus
                managed.
              </Drawer.Description>

              <div className={styles.Actions}>
                <div className={styles.ActionsLeft}>
                  <Drawer.Root>
                    <Drawer.Trigger className={styles.Button}>Security settings</Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Viewport className={styles.Viewport}>
                        <Drawer.Popup className={styles.Popup}>
                          <div className={styles.Handle} />
                          <Drawer.Content className={styles.Content}>
                            <Drawer.Title className={styles.Title}>Security</Drawer.Title>
                            <Drawer.Description className={styles.Description}>
                              Review sign-in activity and update your security preferences.
                            </Drawer.Description>

                            <ul className={styles.List}>
                              <li>Passkeys enabled</li>
                              <li>2FA via authenticator app</li>
                              <li>3 signed-in devices</li>
                            </ul>

                            <div className={styles.Actions}>
                              <div className={styles.ActionsLeft}>
                                <Drawer.Root>
                                  <Drawer.Trigger className={styles.Button}>
                                    Advanced options
                                  </Drawer.Trigger>
                                  <Drawer.Portal>
                                    <Drawer.Viewport className={styles.Viewport}>
                                      <Drawer.Popup className={styles.Popup}>
                                        <div className={styles.Handle} />
                                        <Drawer.Content className={styles.Content}>
                                          <Drawer.Title className={styles.Title}>
                                            Advanced
                                          </Drawer.Title>
                                          <Drawer.Description className={styles.Description}>
                                            This drawer is taller to demonstrate variable-height
                                            stacking.
                                          </Drawer.Description>

                                          <div className={styles.Field}>
                                            <label className={styles.Label} htmlFor="device-name">
                                              Device name
                                            </label>
                                            <input
                                              id="device-name"
                                              className={styles.Input}
                                              defaultValue="Personal laptop"
                                            />
                                          </div>

                                          <div className={styles.Field}>
                                            <label className={styles.Label} htmlFor="notes">
                                              Notes
                                            </label>
                                            <textarea
                                              id="notes"
                                              className={styles.Textarea}
                                              defaultValue="Rotate recovery codes and revoke older sessions."
                                              rows={3}
                                            />
                                          </div>

                                          <div className={styles.Actions}>
                                            <Drawer.Close className={styles.Button}>
                                              Done
                                            </Drawer.Close>
                                          </div>
                                        </Drawer.Content>
                                      </Drawer.Popup>
                                    </Drawer.Viewport>
                                  </Drawer.Portal>
                                </Drawer.Root>
                              </div>

                              <Drawer.Close className={styles.Button}>Close</Drawer.Close>
                            </div>
                          </Drawer.Content>
                        </Drawer.Popup>
                      </Drawer.Viewport>
                    </Drawer.Portal>
                  </Drawer.Root>
                </div>

                <Drawer.Close className={styles.Button}>Close</Drawer.Close>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
