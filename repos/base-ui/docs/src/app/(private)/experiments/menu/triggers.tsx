'use client';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { StoreInspector } from '@base-ui/utils/store';
import demoStyles from 'docs/src/app/(docs)/react/components/menu/demos/submenu/css-modules/index.module.css';
import viewportStyles from 'docs/src/app/(docs)/react/components/menu/demos/detached-triggers-full/css-modules/index.module.css';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import styles from './triggers.module.css';

interface Settings {
  openOnHover: boolean;
  delay: number;
  closeDelay: number;
  side: Menu.Positioner.Props['side'];
  modal: boolean;
  keepMounted: boolean;
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

type ContentKey = keyof typeof contents;

const menu1 = Menu.createHandle<ContentKey>();
const menu2 = Menu.createHandle<ContentKey>();

export default function MenuTriggers() {
  const { settings } = useExperimentSettings<Settings>();

  const [singleTriggerOpen, setSingleTriggerOpen] = React.useState(false);

  const [controlledWithinRootOpen, setControlledWithinRootOpen] = React.useState(false);
  const [controlledWithinRootTriggerId, setControlledWithinRootTriggerId] = React.useState<
    string | null
  >(null);

  const [controlledDetachedOpen, setControlledDetachedOpen] = React.useState(false);
  const [controlledDetachedTriggerId, setControlledDetachedTriggerId] = React.useState<
    string | null
  >(null);

  return (
    <div className={styles.Page}>
      <h1>Menus</h1>

      <h2>Uncontrolled, single trigger</h2>
      <div className={styles.Container}>
        <Menu.Root modal={settings.modal}>
          <StyledTrigger>Library</StyledTrigger>
          {renderMenuContent('Library', settings)}
        </Menu.Root>
        <Menu.Root modal={settings.modal}>
          <StyledTrigger>Playback</StyledTrigger>
          {renderMenuContent('Playback', settings)}
        </Menu.Root>
        <Menu.Root modal={settings.modal}>
          <StyledTrigger>Sharing</StyledTrigger>
          {renderMenuContent('Sharing', settings)}
        </Menu.Root>
      </div>

      <h2>Controlled, single trigger</h2>
      <div className={styles.Container}>
        <Menu.Root
          modal={settings.modal}
          open={singleTriggerOpen}
          onOpenChange={(nextOpen) => setSingleTriggerOpen(nextOpen)}
        >
          <StyledTrigger>Library</StyledTrigger>
          {renderMenuContent('Library', settings)}
        </Menu.Root>
        <button
          type="button"
          className={`${demoStyles.Button} ${styles.ActionButton}`}
          onClick={() => setSingleTriggerOpen(true)}
        >
          Open externally
        </button>
      </div>

      <h2>Uncontrolled, multiple triggers within Root</h2>
      <div className={styles.Container}>
        <Menu.Root modal={settings.modal}>
          {({ payload }) => (
            <React.Fragment>
              <StyledTrigger payload={'Library'} />
              <StyledTrigger payload={'Playback'} />
              <StyledTrigger payload={'Sharing'} />
              {renderMenuContent(payload as ContentKey, settings)}
            </React.Fragment>
          )}
        </Menu.Root>
      </div>

      <h2>Controlled, multiple triggers within Root</h2>
      <div className={styles.Container}>
        <Menu.Root
          modal={settings.modal}
          open={controlledWithinRootOpen}
          onOpenChange={(open, eventDetails) => {
            setControlledWithinRootOpen(open);
            setControlledWithinRootTriggerId(eventDetails.trigger?.id ?? null);
          }}
          triggerId={controlledWithinRootTriggerId}
        >
          {({ payload }) => (
            <React.Fragment>
              <StyledTrigger payload={'Library'} />
              <StyledTrigger payload={'Playback'} id="within-root-second-trigger" />
              <StyledTrigger payload={'Sharing'} />
              {renderMenuContent(payload as ContentKey, settings)}
            </React.Fragment>
          )}
        </Menu.Root>
        <button
          type="button"
          className={`${demoStyles.Button} ${styles.ActionButton}`}
          onClick={() => {
            setControlledWithinRootOpen(true);
            setControlledWithinRootTriggerId('within-root-second-trigger');
          }}
        >
          Open externally (2nd trigger)
        </button>
      </div>

      <h2>Uncontrolled, detached triggers</h2>
      <StoreInspector store={menu1.store} title="Uncontrolled, detached triggers" />
      <div className={styles.Container}>
        <StyledMenu handle={menu1} />
        <StyledTrigger handle={menu1} payload={'Library' as const} />
        <StyledTrigger handle={menu1} payload={'Playback' as const} />
        <StyledTrigger handle={menu1} payload={'Sharing' as const} />
      </div>

      <h2>Controlled, detached triggers</h2>
      <StoreInspector store={menu2.store} title="Controlled, detached triggers" />
      <div className={styles.Container}>
        <StyledMenu
          handle={menu2}
          open={controlledDetachedOpen}
          triggerId={controlledDetachedTriggerId}
          onOpenChange={(open, eventDetails) => {
            setControlledDetachedOpen(open);
            setControlledDetachedTriggerId(eventDetails.trigger?.id ?? null);
          }}
        />
        <StyledTrigger handle={menu2} payload={'Library' as const} />
        <StyledTrigger handle={menu2} payload={'Playback' as const} id="detached-second-trigger" />
        <StyledTrigger handle={menu2} payload={'Sharing' as const} />
        <button
          type="button"
          className={`${demoStyles.Button} ${styles.ActionButton}`}
          onClick={() => {
            setControlledDetachedOpen(true);
            setControlledDetachedTriggerId('detached-second-trigger');
          }}
        >
          Open externally (2nd trigger)
        </button>
        <button
          type="button"
          className={`${demoStyles.Button} ${styles.ActionButton}`}
          onClick={() => {
            menu2.open('detached-second-trigger');
          }}
        >
          Open via handle (2nd trigger)
        </button>
      </div>
    </div>
  );
}

type StyledMenuProps<Payload> = Pick<
  Menu.Root.Props<Payload>,
  'handle' | 'open' | 'onOpenChange' | 'triggerId'
>;

function StyledMenu(props: StyledMenuProps<ContentKey>) {
  const { handle, open, onOpenChange, triggerId } = props;
  const { settings } = useExperimentSettings<Settings>();

  return (
    <Menu.Root
      handle={handle}
      open={open}
      onOpenChange={onOpenChange}
      triggerId={triggerId}
      modal={settings.modal}
    >
      {({ payload }) => renderMenuContent(payload as ContentKey, settings)}
    </Menu.Root>
  );
}

type MenuTriggerPropsWithFeatures<Payload> = Menu.Trigger.Props<Payload> & {
  handle?: Menu.Handle<Payload>;
  payload?: Payload;
};

function StyledTrigger(
  props: MenuTriggerPropsWithFeatures<ContentKey> & React.RefAttributes<HTMLButtonElement>,
) {
  const { settings } = useExperimentSettings<Settings>();
  const { className, children, payload, ...restProps } = props;

  const triggerProps: Menu.Trigger.Props<ContentKey> = {
    ...restProps,
    className: [demoStyles.Button, styles.Trigger, className].filter(Boolean).join(' '),
    openOnHover: settings.openOnHover,
    delay: settings.delay,
    closeDelay: settings.closeDelay,
    payload,
  };

  const content = payload ?? children;

  return (
    <Menu.Trigger {...triggerProps}>
      {content}
      <ChevronDownIcon className={demoStyles.ButtonIcon} />
    </Menu.Trigger>
  );
}

function renderMenuContent(contentKey: ContentKey | undefined, settings: Settings) {
  const items = contentKey ? contents[contentKey] : undefined;

  return (
    <Menu.Portal keepMounted={settings.keepMounted}>
      <Menu.Positioner
        sideOffset={8}
        className={`${demoStyles.Positioner} ${viewportStyles.Positioner}`}
        side={settings.side}
      >
        <Menu.Popup className={`${demoStyles.Popup} ${viewportStyles.Popup}`}>
          <Menu.Arrow className={`${demoStyles.Arrow} ${viewportStyles.Arrow}`}>
            <ArrowSvg />
          </Menu.Arrow>
          <Menu.Viewport className={viewportStyles.Viewport}>
            {items ? (
              items.map((item, index) => renderMenuContentItem(item, `item-${index}`))
            ) : (
              <div className={styles.MenuSection}>No content for this trigger.</div>
            )}
          </Menu.Viewport>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

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

export const settingsMetadata: SettingsMetadata<Settings> = {
  openOnHover: {
    type: 'boolean',
    label: 'Open on hover',
  },
  delay: {
    type: 'number',
    label: 'Delay',
    default: 100,
  },
  closeDelay: {
    type: 'number',
    label: 'Close Delay',
    default: 0,
  },
  side: {
    type: 'string',
    label: 'Side',
    options: ['top', 'bottom', 'inline-start', 'inline-end'],
    default: 'bottom',
  },
  modal: {
    type: 'boolean',
    label: 'Modal',
    default: false,
  },
  keepMounted: {
    type: 'boolean',
    label: 'Keep mounted',
    default: false,
  },
};

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
