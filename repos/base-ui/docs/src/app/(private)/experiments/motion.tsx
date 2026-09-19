'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { motion, AnimatePresence } from 'motion/react';

function ConditionallyMounted() {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>Trigger</Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup
                render={
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                  />
                }
              >
                Popup
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

function AlwaysMounted() {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>Trigger</Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner>
          <Popover.Popup
            render={
              <motion.div
                initial={false}
                animate={{
                  scale: open ? 1 : 0,
                  opacity: open ? 1 : 0,
                }}
              />
            }
          >
            Popup
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NoOpacity() {
  const [open, setOpen] = React.useState(false);
  const actionsRef = React.useRef<Popover.Root.Actions>(null);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        setOpen(nextOpen);
        eventDetails.preventUnmountOnClose();
      }}
      actionsRef={actionsRef}
    >
      <Popover.Trigger>Trigger</Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup
                render={
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onAnimationComplete={() => {
                      if (!open) {
                        actionsRef.current?.unmount();
                      }
                    }}
                  />
                }
              >
                Popup
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export default function Page() {
  return (
    <div>
      <h2>Conditionally mounted</h2>
      <ConditionallyMounted />
      <h2>Always mounted</h2>
      <AlwaysMounted />
      <h2>No opacity</h2>
      <NoOpacity />
    </div>
  );
}
