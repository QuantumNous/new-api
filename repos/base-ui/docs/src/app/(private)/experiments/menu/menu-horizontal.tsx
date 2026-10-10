'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from './menu-horizontal.module.css';

export default function NestedMenu() {
  const createHandleMenuClick = (menuItem: string) => {
    return () => {
      console.log(`Clicked on ${menuItem}`);
    };
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className={styles.Container}>
      <div ref={containerRef} />
      <Menu.Root orientation="horizontal" open modal={false}>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} anchor={containerRef}>
            <Menu.Popup className={styles.MenuRootPopup}>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger openOnHover={false} className={styles.SubmenuTrigger}>
                  Text color
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner align="start" side="bottom" sideOffset={12}>
                    <Menu.Popup className={styles.MenuPopup}>
                      <Menu.Item
                        onClick={createHandleMenuClick('Text color/Black')}
                        className={styles.MenuItem}
                      >
                        Black
                      </Menu.Item>
                      <Menu.Item
                        onClick={createHandleMenuClick('Text color/Dark grey')}
                        className={styles.MenuItem}
                      >
                        Dark grey
                      </Menu.Item>
                      <Menu.Item
                        onClick={createHandleMenuClick('Text color/Accent')}
                        className={styles.MenuItem}
                      >
                        Accent
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger openOnHover={false} className={styles.SubmenuTrigger}>
                  Style
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner align="start" side="bottom" sideOffset={12}>
                    <Menu.Popup className={styles.MenuPopup}>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                          Heading
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner align="start" side="right" sideOffset={12}>
                            <Menu.Popup className={styles.MenuPopup}>
                              <Menu.Item
                                onClick={createHandleMenuClick('Style/Heading/Level 1')}
                                className={styles.MenuItem}
                              >
                                Level 1
                              </Menu.Item>
                              <Menu.Item
                                onClick={createHandleMenuClick('Style/Heading/Level 2')}
                                className={styles.MenuItem}
                              >
                                Level 2
                              </Menu.Item>
                              <Menu.Item
                                onClick={createHandleMenuClick('Style/Heading/Level 3')}
                                className={styles.MenuItem}
                              >
                                Level 3
                              </Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                      <Menu.Item
                        onClick={createHandleMenuClick('Style/Paragraph')}
                        className={styles.MenuItem}
                      >
                        Paragraph
                      </Menu.Item>
                      <Menu.SubmenuRoot disabled>
                        <Menu.SubmenuTrigger className={styles.SubmenuTrigger}>
                          List
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner align="start" side="bottom" sideOffset={12}>
                            <Menu.Popup className={styles.MenuPopup}>
                              <Menu.Item
                                onClick={createHandleMenuClick('Style/List/Ordered')}
                                className={styles.MenuItem}
                              >
                                Ordered
                              </Menu.Item>
                              <Menu.Item
                                onClick={createHandleMenuClick('Style/List/Unordered')}
                                className={styles.MenuItem}
                              >
                                Unordered
                              </Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
