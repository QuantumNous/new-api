'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { Avatar } from '@base-ui/react/avatar';
import { demoPopover } from './vertical-shared';
import styles from './vertical.module.css';

export default function MorphingToolbarDemo() {
  return (
    <div className={styles.Container}>
      <Popover.Trigger
        className={styles.IconButton}
        handle={demoPopover}
        payload={PropertiesPanel}
        id="properties-button"
      >
        <PropertiesIcon aria-label="Notifications" className={styles.Icon} />
      </Popover.Trigger>

      <Popover.Trigger className={styles.IconButton} handle={demoPopover} payload={HistoryPanel}>
        <HistoryIcon aria-label="Profile" className={styles.Icon} />
      </Popover.Trigger>

      <Popover.Trigger className={styles.IconButton} handle={demoPopover} payload={DiscussionPanel}>
        <DiscussionIcon aria-label="Activity" className={styles.Icon} />
      </Popover.Trigger>

      <Popover.Root handle={demoPopover}>
        {({ payload: Payload }) => (
          <Popover.Portal>
            <Popover.Positioner
              sideOffset={12}
              className={styles.Positioner}
              side="right"
              align="start"
            >
              <Popover.Popup className={styles.Popup}>
                <Popover.Arrow className={styles.Arrow}>
                  <ArrowSvg />
                </Popover.Arrow>

                <Popover.Viewport className={styles.Viewport}>
                  {Payload !== undefined && <Payload />}
                </Popover.Viewport>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>
    </div>
  );
}

function PropertiesPanel() {
  return (
    <div className={styles.PropertiesPanel}>
      <Popover.Title className={styles.Title}>Properties</Popover.Title>
      <div className={styles.Fields}>
        <div>
          <label className={styles.Label}>Title</label>
          <input className={styles.Input} defaultValue="React Conf 2025 talk outline" />
        </div>
        <div>
          <label className={styles.Label}>Visibility</label>
          <select className={styles.Input} defaultValue="Public">
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel() {
  return (
    <div className={styles.HistoryPanel}>
      <Popover.Title className={styles.Title}>History</Popover.Title>
      <ol>
        <li>
          <Avatar.Root className={styles.Avatar}>
            <Avatar.Image
              src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
              width="48"
              height="48"
              className={styles.AvatarImage}
            />
          </Avatar.Root>
          <p>
            <span className={styles.UserName}>Jason Eventon</span> created this document{' '}
            <span className={styles.Time}>2 weeks ago</span>.
          </p>
        </li>
        <li>
          <Avatar.Root className={styles.Avatar}>
            <Avatar.Image
              src="https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=128"
              width="48"
              height="48"
              className={styles.AvatarImage}
            />
          </Avatar.Root>
          <p>
            <span className={styles.UserName}>John Doe</span> approved{' '}
            <span className={styles.Time}>36m ago</span>.
          </p>
        </li>
      </ol>
    </div>
  );
}

function DiscussionPanel() {
  return (
    <div className={styles.DiscussionPanel}>
      <Popover.Title className={styles.Title}>Discussion</Popover.Title>
      <p className={styles.NoComments}>There aren't any comments yet.</p>
      <textarea className={styles.TextArea} placeholder="Write a comment…" />
      <div className={styles.Actions}>
        <button className={styles.Button} type="button">
          Post
        </button>
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
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

function PropertiesIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function HistoryIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function DiscussionIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />
    </svg>
  );
}
