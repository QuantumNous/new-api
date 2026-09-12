'use client';
import * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { motion, AnimatePresence } from 'motion/react';
import styles from './transitions.module.css';

export function TooltipPopup({ children, ...props }: React.ComponentProps<typeof Tooltip.Popup>) {
  return (
    <Tooltip.Popup {...props} className={styles.TooltipPopup}>
      {children}
    </Tooltip.Popup>
  );
}

export function AnchorButton({ children, ...props }: React.ComponentProps<typeof Tooltip.Trigger>) {
  return (
    <Tooltip.Trigger {...props} className={styles.AnchorButton}>
      {children}
    </Tooltip.Trigger>
  );
}

export default function TooltipTransitionExperiment() {
  return (
    <div
      style={{
        width: 700,
        padding: 50,
        margin: '0 auto',
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
      <h1>Base UI Tooltip Popup Animations</h1>
      <hr />

      <h2>Conditional Rendering</h2>

      <h3>CSS Animation Group</h3>
      <div style={{ display: 'flex', gap: 5 }}>
        <Tooltip.Provider closeDelay={200}>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={(sizes) => sizes.anchor.height}>
                <TooltipPopup data-type="css-animation">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-animation">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      <h3>CSS Animation</h3>
      <Tooltip.Root>
        <AnchorButton>Anchor</AnchorButton>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={7}>
            <TooltipPopup data-type="css-animation">Tooltip</TooltipPopup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>

      <h3>CSS Transition Group</h3>
      <div style={{ display: 'flex', gap: 5 }}>
        <Tooltip.Provider closeDelay={200}>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-transition">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-transition">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      <h3>CSS Transition</h3>
      <Tooltip.Root>
        <AnchorButton>Anchor</AnchorButton>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={7}>
            <TooltipPopup data-type="css-transition">Tooltip</TooltipPopup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>

      <h3>CSS Transition with `@starting-style`</h3>
      <p>
        No longer supported due to{' '}
        <a href="https://github.com/mui/base-ui/pull/992">
          https://github.com/mui/base-ui/pull/992
        </a>
      </p>
      <Tooltip.Root>
        <AnchorButton>Anchor</AnchorButton>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={7}>
            <TooltipPopup data-type="css-transition-starting-style">Tooltip</TooltipPopup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>

      <hr />

      <h2>Keep Mounted</h2>

      <h3>CSS Animation Group</h3>
      <div style={{ display: 'flex', gap: 5 }}>
        <Tooltip.Provider closeDelay={200}>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal keepMounted>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-animation-keep-mounted">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal keepMounted>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-animation-keep-mounted">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      <h3>CSS Animation</h3>
      <Tooltip.Root>
        <AnchorButton>Anchor</AnchorButton>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner sideOffset={7}>
            <TooltipPopup data-type="css-animation-keep-mounted">Tooltip</TooltipPopup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>

      <h3>CSS Transition Group</h3>
      <div style={{ display: 'flex', gap: 5 }}>
        <Tooltip.Provider closeDelay={200}>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal keepMounted>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-transition-keep-mounted">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <AnchorButton>Anchor</AnchorButton>
            <Tooltip.Portal keepMounted>
              <Tooltip.Positioner sideOffset={7}>
                <TooltipPopup data-type="css-transition-keep-mounted">Tooltip</TooltipPopup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      <h3>CSS Transition</h3>
      <Tooltip.Root>
        <AnchorButton>Anchor</AnchorButton>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner sideOffset={7}>
            <TooltipPopup data-type="css-transition-keep-mounted">Tooltip</TooltipPopup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>

      <hr />

      <h2>JavaScript Animation (`framer-motion`)</h2>
      <FramerMotion />
    </div>
  );
}

function FramerMotion() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
      <AnchorButton>Anchor</AnchorButton>
      <AnimatePresence>
        {isOpen && (
          <Tooltip.Portal keepMounted>
            <Tooltip.Positioner sideOffset={7}>
              <TooltipPopup
                data-type="framer-motion"
                render={
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    exit={{ opacity: 0, scale: 0 }}
                  />
                }
              >
                Tooltip
              </TooltipPopup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </AnimatePresence>
    </Tooltip.Root>
  );
}
