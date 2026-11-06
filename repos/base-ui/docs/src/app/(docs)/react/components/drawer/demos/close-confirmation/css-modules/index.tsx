'use client';
import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Drawer } from '@base-ui/react/drawer';
import styles from './index.module.css';

export default function ExampleDrawer() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [confirmationOpen, setConfirmationOpen] = React.useState(false);
  const [textareaValue, setTextareaValue] = React.useState('');
  const titleId = React.useId();

  return (
    <Drawer.Root
      swipeDirection="right"
      open={drawerOpen}
      onOpenChange={(open, eventDetails) => {
        // Show the close confirmation if there’s text in the textarea
        if (!open && textareaValue) {
          eventDetails.cancel();
          setConfirmationOpen(true);
          return;
        }
        if (!open) {
          // Reset the textarea value
          setTextareaValue('');
        }
        setDrawerOpen(open);
      }}
    >
      <Drawer.Trigger className={styles.Button}>Tweet</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.Backdrop} />
        <Drawer.Viewport className={styles.Viewport}>
          <Drawer.Popup
            className={`${styles.Popup} ${confirmationOpen ? styles.PopupDimmed : ''}`.trim()}
          >
            <Drawer.Content className={styles.Content}>
              <Drawer.Title id={titleId} className={styles.Title}>
                New tweet
              </Drawer.Title>
              <form
                className={styles.TextareaContainer}
                onSubmit={(event) => {
                  event.preventDefault();
                  // Close the drawer when submitting
                  setTextareaValue('');
                  setDrawerOpen(false);
                }}
              >
                <textarea
                  aria-labelledby={titleId}
                  required
                  className={styles.Textarea}
                  placeholder="What’s on your mind?"
                  value={textareaValue}
                  onChange={(event) => setTextareaValue(event.target.value)}
                />
                <div className={styles.Actions}>
                  <Drawer.Close className={styles.Button}>Cancel</Drawer.Close>
                  <button type="submit" className={styles.Button}>
                    Tweet
                  </button>
                </div>
              </form>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>

      {/* Confirmation dialog */}
      <AlertDialog.Root open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Popup className={styles.AlertPopup}>
            <div className={styles.Intro}>
              <AlertDialog.Title className={styles.Title}>Discard tweet?</AlertDialog.Title>
              <AlertDialog.Description className={styles.Description}>
                Your tweet will be lost.
              </AlertDialog.Description>
            </div>
            <div className={styles.Actions}>
              <AlertDialog.Close className={styles.Button}>Go back</AlertDialog.Close>
              <button
                type="button"
                className={styles.Button}
                onClick={() => {
                  setConfirmationOpen(false);
                  setTextareaValue('');
                  setDrawerOpen(false);
                }}
              >
                Discard
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Drawer.Root>
  );
}
