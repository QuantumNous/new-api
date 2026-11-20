import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import styles from './popups-transform-origin.module.css';
import type { Side } from '../../../../../../packages/react/src/utils/useAnchorPositioning';

function Popover({ side }: { side: Side }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className={styles.Trigger}>{side}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} sideOffset={20}>
          <PopoverPrimitive.Popup className={styles.Popup} />
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function PopoverWithArrow({ side }: { side: Side }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className={styles.Trigger}>{side}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} sideOffset={20}>
          <PopoverPrimitive.Popup className={styles.Popup}>
            <PopoverPrimitive.Arrow className={styles.Arrow} />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ShiftSide({ side }: { side: Side }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className={styles.Trigger}>{side}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side={side}
          sideOffset={20}
          collisionAvoidance={{ side: 'shift' }}
        >
          <PopoverPrimitive.Popup
            className={styles.Popup}
            style={{ height: 600, maxHeight: 'var(--available-height)' }}
          />
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default function PopupTransformOrigin() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p>Popovers should emanate from the anchor's center or arrow tip.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Popover side="top" />
        <Popover side="right" />
        <Popover side="bottom" />
        <Popover side="left" />
      </div>
      <h2>With arrow</h2>
      <div style={{ display: 'flex', gap: 10 }}>
        <PopoverWithArrow side="top" />
        <PopoverWithArrow side="right" />
        <PopoverWithArrow side="bottom" />
        <PopoverWithArrow side="left" />
      </div>
      <h2>Shift side</h2>
      <div style={{ display: 'flex', gap: 10 }}>
        <ShiftSide side="top" />
        <ShiftSide side="bottom" />
      </div>
    </div>
  );
}
