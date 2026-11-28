'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { motion, type HTMLMotionProps } from 'motion/react';
import styles from './index.module.css';

export default function AnimatedPopoverMotionKeepMountedTrueDemo() {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.Trigger}>Trigger</Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner className={styles.Positioner} sideOffset={8}>
          <Popover.Popup
            className={styles.Popup}
            render={(props, state) => (
              <motion.div
                {...(props as HTMLMotionProps<'div'>)}
                initial={false}
                animate={{
                  opacity: state.open ? 1 : 0,
                  scale: state.open ? 1 : 0.8,
                }}
              />
            )}
          >
            Popup
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
