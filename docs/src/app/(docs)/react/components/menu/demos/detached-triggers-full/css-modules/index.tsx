'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import styles from '../../_index.module.css';
import transitionStyles from './index.module.css';

type MenuContent = {
  heading: string;
  groups: string[][];
};

const MENUS = {
  library: {
    heading: 'Library',
    groups: [
      ['Add to library', 'Add to favorites'],
      ['Create playlist', 'Create station'],
    ],
  },
  playback: {
    heading: 'Playback',
    groups: [
      ['Play now', 'Add to queue'],
      ['Play next', 'Play last', 'Sleep timer'],
    ],
  },
  share: {
    heading: 'Share',
    groups: [
      ['Copy link', 'Copy embed code'],
      ['Share to contacts', 'Share to social'],
    ],
  },
} as const satisfies Record<string, MenuContent>;

type MenuKey = keyof typeof MENUS;

const demoMenu = Menu.createHandle<MenuKey>();

export default function MenuDetachedTriggersFullDemo() {
  return (
    <div className={styles.Container}>
      <Menu.Trigger className={styles.Button} handle={demoMenu} payload="library">
        Library
      </Menu.Trigger>
      <Menu.Trigger className={styles.Button} handle={demoMenu} payload="playback">
        Playback
      </Menu.Trigger>
      <Menu.Trigger className={styles.Button} handle={demoMenu} payload="share">
        Share
      </Menu.Trigger>

      <Menu.Root handle={demoMenu} modal={false}>
        {({ payload }) => (
          <Menu.Portal>
            <Menu.Positioner
              sideOffset={8}
              className={`${styles.Positioner} ${transitionStyles.Positioner}`}
            >
              <Menu.Popup className={`${styles.Popup} ${transitionStyles.Popup}`}>
                <Menu.Viewport className={transitionStyles.Viewport}>
                  {payload &&
                    MENUS[payload].groups.map((group, groupIndex) => (
                      <React.Fragment key={groupIndex}>
                        <Menu.Group>
                          {groupIndex === 0 && (
                            <Menu.GroupLabel className={styles.Label}>
                              {MENUS[payload].heading}
                            </Menu.GroupLabel>
                          )}
                          {group.map((item) => (
                            <Menu.Item key={item} className={styles.Item}>
                              {item}
                            </Menu.Item>
                          ))}
                        </Menu.Group>
                        {groupIndex < MENUS[payload].groups.length - 1 && (
                          <Menu.Separator className={styles.Separator} />
                        )}
                      </React.Fragment>
                    ))}
                </Menu.Viewport>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </Menu.Root>
    </div>
  );
}
