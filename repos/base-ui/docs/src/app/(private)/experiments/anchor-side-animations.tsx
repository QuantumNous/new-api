import { Popover } from '@base-ui/react/popover';
import classes from './anchor-side-animations.module.css';

export default function AnchorSideAnimations() {
  return (
    <div style={{ maxWidth: 500 }}>
      <p>
        The animation should always play translating <strong>toward</strong> the trigger on the
        first open. Its side is `top` by default, but flips to the bottom as the result of a
        collision. This demo determines if it successfully waits for the side to be calculated
        before playing the animation.
      </p>
      <Popover.Root>
        <Popover.Trigger>transition</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top">
            <Popover.Popup className={classes.Popup} data-type="transition" />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <Popover.Root>
        <Popover.Trigger>animation</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top">
            <Popover.Popup className={classes.Popup} data-type="animation" />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
