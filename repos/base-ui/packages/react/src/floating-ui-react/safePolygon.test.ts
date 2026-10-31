import { vi, expect } from 'vitest';
import { act } from '@mui/internal-test-utils';
import { FloatingTreeStore } from './components/FloatingTreeStore';
import type { HandleCloseContext } from './hooks/useHoverShared';
import type { FloatingContext } from './types';
import { safePolygon } from './safePolygon';
import { getEmptyRootContext } from './utils/getEmptyRootContext';

function createRect(left: number, top: number, width: number, height: number) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  } satisfies DOMRect;
}

function createMouseMoveEvent(
  clientX: number,
  clientY: number,
  target: EventTarget | null = null,
): MouseEvent {
  return {
    type: 'mousemove',
    clientX,
    clientY,
    relatedTarget: null,
    composedPath: () => [target],
  } as unknown as MouseEvent;
}

function createHandleCloseContext({
  domReference,
  floating,
  onClose,
  tree,
  placement = 'right',
  x = 2,
  y = 0,
}: {
  domReference: Element;
  floating: HTMLElement;
  onClose: () => void;
  tree: FloatingTreeStore;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  x?: number;
  y?: number;
}): HandleCloseContext {
  return {
    x,
    y,
    placement,
    elements: { domReference, floating },
    nodeId: 'root',
    onClose,
    tree,
  };
}

function createFloatingContext({
  domReference,
  floating,
  open,
}: {
  domReference: Element;
  floating: HTMLElement;
  open: boolean;
}): FloatingContext {
  const refs: FloatingContext['refs'] = {
    reference: { current: domReference },
    floating: { current: floating },
    domReference: { current: domReference },
    setReference() {},
    setFloating() {},
    setPositionReference() {},
  };

  const events: FloatingContext['events'] = {
    emit() {},
    on() {},
    off() {},
  };

  return {
    x: 0,
    y: 0,
    strategy: 'absolute',
    placement: 'right',
    middlewareData: {},
    isPositioned: true,
    update: async () => {},
    floatingStyles: {},
    open,
    onOpenChange() {},
    events,
    dataRef: { current: {} },
    nodeId: 'root',
    floatingId: 'floating-id',
    refs,
    elements: { reference: domReference, domReference, floating },
    rootStore: getEmptyRootContext(),
  };
}

function createPlacementScenario(placement: 'top' | 'bottom' | 'left' | 'right') {
  const referenceRect = createRect(0, 0, 100, 100);

  switch (placement) {
    case 'top':
      return {
        referenceRect,
        floatingRect: createRect(0, -120, 100, 100),
        leavePoint: [50, 0] as const,
        troughPoint: [50, -10] as const,
        outsidePoint: [50, 150] as const,
      };
    case 'bottom':
      return {
        referenceRect,
        floatingRect: createRect(0, 120, 100, 100),
        leavePoint: [50, 100] as const,
        troughPoint: [50, 110] as const,
        outsidePoint: [50, -50] as const,
      };
    case 'left':
      return {
        referenceRect,
        floatingRect: createRect(-120, 0, 100, 100),
        leavePoint: [0, 50] as const,
        troughPoint: [-10, 50] as const,
        outsidePoint: [150, 50] as const,
      };
    case 'right':
      return {
        referenceRect,
        floatingRect: createRect(120, 0, 100, 100),
        leavePoint: [100, 50] as const,
        troughPoint: [110, 50] as const,
        outsidePoint: [-50, 50] as const,
      };
    default:
      return {
        referenceRect,
        floatingRect: createRect(120, 0, 100, 100),
        leavePoint: [100, 50] as const,
        troughPoint: [110, 50] as const,
        outsidePoint: [-50, 50] as const,
      };
  }
}

describe('safePolygon', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not close when a nested child is open', async () => {
    const domReference = document.createElement('button');
    const floating = document.createElement('div');
    domReference.getBoundingClientRect = () => createRect(0, 0, 100, 100);
    floating.getBoundingClientRect = () => createRect(120, 0, 100, 100);

    const tree = new FloatingTreeStore();
    const onClose = vi.fn();
    const context = createHandleCloseContext({
      domReference,
      floating,
      onClose,
      tree,
    });

    const openChildContext = createFloatingContext({ domReference, floating, open: true });
    tree.addNode({ id: 'child', parentId: 'root', context: openChildContext });

    const handler = safePolygon()(context);
    handler(createMouseMoveEvent(3, -1));

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it('does not close when an open nested child is behind a contextless intermediary node', async () => {
    const domReference = document.createElement('button');
    const floating = document.createElement('div');
    domReference.getBoundingClientRect = () => createRect(0, 0, 100, 100);
    floating.getBoundingClientRect = () => createRect(120, 0, 100, 100);

    const tree = new FloatingTreeStore();
    const onClose = vi.fn();
    const context = createHandleCloseContext({
      domReference,
      floating,
      onClose,
      tree,
    });

    const openChildContext = createFloatingContext({ domReference, floating, open: true });
    tree.addNode({ id: 'inline-root', parentId: 'root' });
    tree.addNode({ id: 'child', parentId: 'inline-root', context: openChildContext });

    const handler = safePolygon()(context);
    handler(createMouseMoveEvent(3, -1));

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it('closes after intent timeout when no nested child is open', async () => {
    const domReference = document.createElement('button');
    const floating = document.createElement('div');
    domReference.getBoundingClientRect = () => createRect(0, 0, 100, 100);
    floating.getBoundingClientRect = () => createRect(120, 0, 100, 100);

    const tree = new FloatingTreeStore();
    const onClose = vi.fn();
    const context = createHandleCloseContext({
      domReference,
      floating,
      onClose,
      tree,
    });

    const closedChildContext = createFloatingContext({ domReference, floating, open: false });
    tree.addNode({ id: 'child', parentId: 'root', context: closedChildContext });

    const handler = safePolygon()(context);
    handler(createMouseMoveEvent(3, -1));

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'keeps open while moving through the trough on %s placement',
    (placement) => {
      const domReference = document.createElement('button');
      const floating = document.createElement('div');
      const scenario = createPlacementScenario(placement);

      domReference.getBoundingClientRect = () => scenario.referenceRect;
      floating.getBoundingClientRect = () => scenario.floatingRect;

      const tree = new FloatingTreeStore();
      const onClose = vi.fn();
      const context = createHandleCloseContext({
        domReference,
        floating,
        onClose,
        tree,
        placement,
        x: scenario.leavePoint[0],
        y: scenario.leavePoint[1],
      });

      const handler = safePolygon()(context);
      handler(createMouseMoveEvent(scenario.troughPoint[0], scenario.troughPoint[1]));

      expect(onClose).toHaveBeenCalledTimes(0);
    },
  );

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'closes when moving away from corridor on %s placement',
    (placement) => {
      const domReference = document.createElement('button');
      const floating = document.createElement('div');
      const scenario = createPlacementScenario(placement);

      domReference.getBoundingClientRect = () => scenario.referenceRect;
      floating.getBoundingClientRect = () => scenario.floatingRect;

      const tree = new FloatingTreeStore();
      const onClose = vi.fn();
      const context = createHandleCloseContext({
        domReference,
        floating,
        onClose,
        tree,
        placement,
        x: scenario.leavePoint[0],
        y: scenario.leavePoint[1],
      });

      const handler = safePolygon()(context);
      handler(createMouseMoveEvent(scenario.outsidePoint[0], scenario.outsidePoint[1]));

      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it('resets traversal state for a new handler invocation', () => {
    const domReference = document.createElement('button');
    const floating = document.createElement('div');
    const scenario = createPlacementScenario('right');

    domReference.getBoundingClientRect = () => scenario.referenceRect;
    floating.getBoundingClientRect = () => scenario.floatingRect;

    const tree = new FloatingTreeStore();
    const onClose = vi.fn();
    const context = createHandleCloseContext({
      domReference,
      floating,
      onClose,
      tree,
      placement: 'right',
      x: scenario.leavePoint[0],
      y: scenario.leavePoint[1],
    });

    const handleClose = safePolygon();
    const firstHandler = handleClose(context);
    firstHandler(createMouseMoveEvent(130, 50, floating));

    const secondHandler = handleClose(context);
    secondHandler(createMouseMoveEvent(scenario.troughPoint[0], scenario.troughPoint[1]));

    expect(onClose).toHaveBeenCalledTimes(0);
  });
});
