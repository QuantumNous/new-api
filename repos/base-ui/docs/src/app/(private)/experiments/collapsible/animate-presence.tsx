'use client';
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as Collapsible from './_components/Collapsible';
import styles from './collapsible.module.css';

export default function CollapsibleAnimatePresence() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={styles.wrapper}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger>Trigger 16</Collapsible.Trigger>
        <AnimatePresence>
          {open && (
            <Collapsible.Panel
              key="panel"
              hidden={undefined}
              keepMounted
              render={
                <motion.div
                  initial={{ height: 0 }}
                  animate={{
                    height: '100%',
                    transition: { duration: 1 },
                  }}
                  exit={{
                    display: 'block',
                    height: 0,
                    transition: { duration: 1 },
                  }}
                />
              }
            >
              <Collapsible.Content>
                <p>
                  “Certainly; it would indeed be very impertinent and inhuman in me to trouble you
                  with any inquisitiveness of mine.”
                </p>
                <p>
                  “And yet you rescued me from a strange and perilous situation; you have
                  benevolently restored me to life.”
                </p>
                <p>
                  Soon after this he inquired if I thought that the breaking up of the ice had
                  destroyed the other sledge. I replied that I could not answer with any degree of
                  certainty, for the ice had not broken until near midnight, and the traveller might
                  have arrived at a place of safety before that time; but of this I could not judge.
                </p>
              </Collapsible.Content>
            </Collapsible.Panel>
          )}
        </AnimatePresence>
      </Collapsible.Root>
    </div>
  );
}
