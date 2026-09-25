'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Menubar } from '@base-ui/react/menubar';
import { Toolbar } from '@base-ui/react/toolbar';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { StoreInspector } from '@base-ui/utils/store';
import demoStyles from 'docs/src/app/(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import styles from './nested-detached-triggers.module.css';

const contents = {
  Library: [
    { type: 'item', label: 'Add to Library' },
    {
      type: 'submenu',
      label: 'Add to Playlist',
      menu: [
        { type: 'item', label: 'Favorites' },
        { type: 'item', label: 'Chill Vibes' },
        { type: 'item', label: 'Workout Mix' },
      ],
    },
    { type: 'separator' },
    { type: 'item', label: "Favorite (don't close on click)", closeOnClick: false },
    {
      type: 'submenu',
      label: 'Share',
      menu: [
        { type: 'item', label: 'Copy Link' },
        {
          type: 'submenu',
          label: 'Social Media',
          menu: [
            { type: 'item', label: 'Facebook' },
            { type: 'item', label: 'Twitter' },
            { type: 'item', label: 'Instagram' },
          ],
        },
      ],
    },
  ] as MenuContentItem[],
  Playback: [
    { type: 'item', label: 'Play Next' },
    { type: 'item', label: 'Play Last' },
    { type: 'separator' },
    { type: 'item', label: 'Play on Device' },
    { type: 'item', label: 'Download for Offline' },
  ] as MenuContentItem[],
  Sharing: [
    { type: 'item', label: 'Start Radio' },
    { type: 'item', label: 'Create Station' },
    { type: 'separator' },
    { type: 'item', label: 'Follow Artist' },
    { type: 'item', label: 'View Artist' },
  ] as MenuContentItem[],
};

const topLevelContentKeys: ContentKey[] = Object.keys(contents) as ContentKey[];

export default function Experiment() {
  const menu1Handle = useRefWithInit(() => Menu.createHandle<ContentKey>()).current;

  return (
    <div className={styles.Page}>
      <h1>Nested menus with detached triggers</h1>
      <p>This experiment shows the same Menu instance used across different components.</p>
      <StoreInspector store={menu1Handle.store} />

      <h2>In Menubar</h2>
      <div>
        <h3>Detached</h3>
        <Menubar className={styles.Menubar}>
          {topLevelContentKeys.map((contentKey) => (
            <Menu.Trigger
              className={styles.MenuTrigger}
              handle={menu1Handle}
              payload={contentKey}
              key={contentKey}
            >
              {contentKey}
            </Menu.Trigger>
          ))}
        </Menubar>

        <h3>Multiple contained</h3>
        <Menubar className={styles.Menubar}>
          <ReusableMenu>
            {topLevelContentKeys.map((contentKey) => (
              <Menu.Trigger className={styles.MenuTrigger} payload={contentKey} key={contentKey}>
                {contentKey}
              </Menu.Trigger>
            ))}
          </ReusableMenu>
        </Menubar>

        <h2>In Toolbar</h2>
        <Toolbar.Root className={styles.Toolbar}>
          {topLevelContentKeys.map((contentKey) => (
            <Toolbar.Button
              className={styles.ToolbarButton}
              key={contentKey}
              render={
                <Menu.Trigger
                  className={styles.MenuTrigger}
                  handle={menu1Handle}
                  payload={contentKey}
                  key={contentKey}
                />
              }
            >
              {contentKey}
            </Toolbar.Button>
          ))}
        </Toolbar.Root>

        <Toolbar.Root className={styles.Toolbar}>
          {topLevelContentKeys.map((contentKey) => (
            <Toolbar.Button
              className={styles.ToolbarButton}
              key={contentKey}
              render={
                <Menu.Trigger
                  className={styles.MenuTrigger}
                  handle={menu1Handle}
                  payload={contentKey}
                  key={contentKey}
                />
              }
            >
              {contentKey}
            </Toolbar.Button>
          ))}
        </Toolbar.Root>

        <h2>Standalone</h2>
        <div className={styles.StandaloneTriggerContainer}>
          {topLevelContentKeys.map((contentKey) => (
            <Menu.Trigger
              className={demoStyles.Button}
              handle={menu1Handle}
              payload={contentKey}
              key={contentKey}
            >
              {contentKey}
            </Menu.Trigger>
          ))}
        </div>

        <ReusableMenu handle={menu1Handle} />
      </div>
    </div>
  );
}

function ReusableMenu(props: { handle?: Menu.Handle<ContentKey>; children?: React.ReactNode }) {
  const { handle, children } = props;

  return (
    <Menu.Root handle={handle}>
      {({ payload: contentKey }) => {
        const items = contentKey ? contents[contentKey] : undefined;
        return (
          <React.Fragment>
            {children}
            <Menu.Portal>
              <Menu.Positioner sideOffset={8} className={demoStyles.Positioner}>
                <Menu.Popup className={demoStyles.Popup}>
                  <Menu.Arrow className={demoStyles.Arrow}>
                    <ArrowSvg />
                  </Menu.Arrow>
                  {items ? (
                    items.map((item, index) => renderMenuContentItem(item, `item-${index}`))
                  ) : (
                    <div className={styles.MenuSection}>No content for this trigger.</div>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </React.Fragment>
        );
      }}
    </Menu.Root>
  );
}

type MenuContentRegularItem = {
  type: 'item';
  label: string;
  disabled?: boolean;
  closeOnClick?: boolean;
  onClick?: () => void;
};

type MenuContentSeparator = { type: 'separator' };

type MenuContentSubmenu = {
  type: 'submenu';
  label: string;
  menu: MenuContentItem[];
};

type MenuContentItem = MenuContentRegularItem | MenuContentSeparator | MenuContentSubmenu;

type ContentKey = keyof typeof contents;

function renderMenuContentItem(item: MenuContentItem, key: string) {
  switch (item.type) {
    case 'item':
      return (
        <Menu.Item
          className={demoStyles.Item}
          disabled={item.disabled}
          closeOnClick={item.closeOnClick}
          onClick={item.onClick ?? (() => console.log('Clicked on', item.label))}
          key={key}
        >
          {item.label}
        </Menu.Item>
      );
    case 'separator':
      return <Menu.Separator className={demoStyles.Separator} key={key} />;
    case 'submenu':
      return (
        <Menu.SubmenuRoot key={key}>
          <Menu.SubmenuTrigger className={demoStyles.SubmenuTrigger}>
            {item.label}
            <ChevronRightIcon />
          </Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner className={demoStyles.Positioner} alignOffset={-4} sideOffset={-4}>
              <Menu.Popup className={demoStyles.Popup}>
                {item.menu.map((subItem, subIndex) =>
                  renderMenuContentItem(subItem, `${key}.${subIndex}`),
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    default:
      return null;
  }
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={demoStyles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={demoStyles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={demoStyles.ArrowInnerStroke}
      />
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
