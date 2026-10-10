import * as React from 'react';
import { expectType } from '#test-utils';
import { Drawer } from '@base-ui/react/drawer';
import { REASONS } from '../../internals/reasons';

type DrawerChangeHandler = NonNullable<Drawer.Root.Props['onOpenChange']>;
type DrawerChangeDetails = Parameters<DrawerChangeHandler>[1];
type DrawerSwipeEvent = Extract<DrawerChangeDetails, { reason: typeof REASONS.swipe }>['event'];

expectType<PointerEvent | TouchEvent, DrawerSwipeEvent>(null as unknown as DrawerSwipeEvent);

function assertDrawerChange(details: DrawerChangeDetails) {
  if (details.reason === REASONS.swipe) {
    const event: PointerEvent | TouchEvent = details.event;
    void event;
    // @ts-expect-error swipe details should not expose keyboard events
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }

  if (details.reason === REASONS.escapeKey) {
    const event: KeyboardEvent = details.event;
    void event;
  }
}

const handleDrawerChange: DrawerChangeHandler = (open, details) => {
  expectType<boolean, typeof open>(open);
  assertDrawerChange(details);
};

const drawerOpenChangeReasonNarrowing = (
  <Drawer.Root onOpenChange={handleDrawerChange}>
    <Drawer.Trigger />
    <Drawer.Portal />
  </Drawer.Root>
);

void drawerOpenChangeReasonNarrowing;
