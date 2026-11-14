'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Drawer } from '@base-ui/react/drawer';
import styles from './touch-ignore.module.css';

type EventName = 'plain div click' | 'ignored div click' | 'native button click' | 'drawer closed';

export default function DrawerTouchIgnoreExperiment() {
  const [plainDivClicks, setPlainDivClicks] = React.useState(0);
  const [ignoredDivClicks, setIgnoredDivClicks] = React.useState(0);
  const [buttonClicks, setButtonClicks] = React.useState(0);
  const [events, setEvents] = React.useState<EventName[]>([]);

  function recordEvent(eventName: EventName) {
    setEvents((previousEvents) => [eventName, ...previousEvents].slice(0, 8));
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Header}>
        <h1 className={styles.Title}>Drawer touch ignore experiment</h1>
        <p className={styles.Lead}>
          Use this to compare touch behavior inside <code>Drawer.Content</code>. The plain div
          should still participate in swipe-to-dismiss, while the explicit{' '}
          <code>data-base-ui-swipe-ignore</code> div should preserve taps.
        </p>
      </div>

      <div className={styles.PanelGrid}>
        <div className={styles.InstructionsPanel}>
          <h2 className={styles.PanelTitle}>What to test</h2>
          <ol className={styles.InstructionsList}>
            <li>Tap the plain div on a touch device. It should still be part of swipe handling.</li>
            <li>
              Tap the <code>data-base-ui-swipe-ignore</code> div. Its click counter should
              increment.
            </li>
            <li>Tap the native button. It should continue to work as before.</li>
            <li>Drag from the plain div area to confirm swipe-to-dismiss still starts there.</li>
          </ol>
        </div>

        <div className={styles.EventsPanel}>
          <h2 className={styles.EventsTitle}>Latest events</h2>
          <div className={styles.CounterList}>
            <CounterRow label="Plain div clicks" value={plainDivClicks} />
            <CounterRow label="Ignored div clicks" value={ignoredDivClicks} />
            <CounterRow label="Native button clicks" value={buttonClicks} />
          </div>
          <div className={styles.EventLogSection}>
            <div className={styles.EventLogHeading}>Event log</div>
            <ul className={styles.EventList}>
              {events.length === 0 ? <li>No events yet.</li> : null}
              {events.map((eventName, index) => (
                <li key={`${eventName}-${index}`}>{eventName}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Drawer.Root
        onOpenChange={(open) => {
          if (!open) {
            recordEvent('drawer closed');
          }
        }}
      >
        <Drawer.Trigger className={styles.TriggerButton}>Open touch test drawer</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className={styles.Backdrop} />
          <Drawer.Viewport className={styles.Viewport}>
            <Drawer.Popup className={styles.Popup}>
              <div className={styles.Handle} />
              <Drawer.Content className={styles.DrawerContent}>
                <Drawer.Title className={styles.DrawerTitle}>Touch behavior test</Drawer.Title>
                <Drawer.Description className={styles.DrawerDescription}>
                  The tiles below intentionally use different interaction models so you can verify
                  the drawer bugfix on a real touch device or emulator.
                </Drawer.Description>

                <div className={styles.TileGrid}>
                  {/* Intentional non-interactive div to reproduce the touch click behavior. */}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                  <div
                    className={clsx(styles.Tile, styles.TileAmber)}
                    onClick={() => {
                      setPlainDivClicks((value) => value + 1);
                      recordEvent('plain div click');
                    }}
                  >
                    <div className={clsx(styles.TileTitle, styles.TileTitleAmber)}>
                      Plain div inside Drawer.Content
                    </div>
                    <div className={clsx(styles.TileDescription, styles.TileDescriptionAmber)}>
                      On touch, this area should still participate in swipe-to-dismiss.
                    </div>
                  </div>

                  {/* Intentional non-interactive div to reproduce explicit swipe-ignore behavior. */}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                  <div
                    data-base-ui-swipe-ignore
                    className={clsx(styles.Tile, styles.TileEmerald)}
                    onClick={() => {
                      setIgnoredDivClicks((value) => value + 1);
                      recordEvent('ignored div click');
                    }}
                  >
                    <div className={clsx(styles.TileTitle, styles.TileTitleEmerald)}>
                      Div with data-base-ui-swipe-ignore
                    </div>
                    <div className={clsx(styles.TileDescription, styles.TileDescriptionEmerald)}>
                      Tapping here should preserve the click even on touch.
                    </div>
                  </div>

                  <button
                    type="button"
                    className={clsx(styles.Tile, styles.TileSky)}
                    onClick={() => {
                      setButtonClicks((value) => value + 1);
                      recordEvent('native button click');
                    }}
                  >
                    <div className={clsx(styles.TileTitle, styles.TileTitleSky)}>Native button</div>
                    <div className={clsx(styles.TileDescription, styles.TileDescriptionSky)}>
                      Control case to compare against the custom div targets.
                    </div>
                  </button>
                </div>

                <div className={styles.Actions}>
                  <Drawer.Close className={styles.CloseButton}>Close</Drawer.Close>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function CounterRow(props: { label: string; value: number }) {
  const { label, value } = props;

  return (
    <div className={styles.CounterRow}>
      <span>{label}</span>
      <span className={styles.CounterValue}>{value}</span>
    </div>
  );
}
