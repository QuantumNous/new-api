import { expect, test, vi } from 'vitest';
import * as React from 'react';
import { flushMicrotasks, render } from '@mui/internal-test-utils';
import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStore';
import { useFloating } from './useFloating';

function createRootStore(floatingElement: HTMLElement) {
  return new FloatingRootStore({
    open: true,
    transitionStatus: undefined,
    referenceElement: document.createElement('button'),
    floatingElement,
    triggerElements: new PopupTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

function Test({ rootContext }: { rootContext: FloatingRootStore }) {
  useFloating({ rootContext });
  return null;
}

test('preserves an externally synced floating element when the root context changes', async () => {
  const firstFloatingElement = document.createElement('div');
  const secondFloatingElement = document.createElement('div');
  const firstStore = createRootStore(firstFloatingElement);
  const secondStore = createRootStore(secondFloatingElement);

  const { rerender } = render(<Test rootContext={firstStore} />);
  await flushMicrotasks();

  expect(firstStore.state.floatingElement).toBe(firstFloatingElement);

  rerender(<Test rootContext={secondStore} />);
  await flushMicrotasks();

  expect(secondStore.state.floatingElement).toBe(secondFloatingElement);
});
