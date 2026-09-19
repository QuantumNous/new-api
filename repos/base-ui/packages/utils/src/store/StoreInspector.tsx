'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { isElement } from '@floating-ui/utils/dom';
import { mergeCleanups } from '../mergeCleanups';
import { ownerDocument, ownerWindow } from '../owner';
import { addEventListener } from '../addEventListener';
import { Store } from './Store';
import { useForcedRerendering } from '../useForcedRerendering';
import { useStableCallback } from '../useStableCallback';
import { useAnimationFrame } from '../useAnimationFrame';
import { useIsoLayoutEffect } from '../useIsoLayoutEffect';
import { useTimeout } from '../useTimeout';

const STYLES = `
.baseui-store-inspector-trigger {
  all: unset;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: oklch(0.651 0.078 264);
}

.baseui-store-inspector-trigger:hover,
.baseui-store-inspector-trigger:focus-visible {
 opacity: 0.8;
}

.baseui-store-inspector-content {
  background: #101010;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-bottom: 12px;
  scrollbar-width: thin;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.baseui-store-inspector-content h3 {
  text-transform: uppercase;
  font-weight: bold;
}

.baseui-store-inspector-content pre {
  margin: 0 0 16px 0;
}

.baseui-store-inspector-content pre:last-child {
  margin-bottom: 0;
}

.baseui-store-inspector-root {
  position: fixed;
  background: oklch(0.34 0.036 264);
  color: #fff;
  z-index: 1000;
  font-size: 12px;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 50vw;
  color-scheme: dark;
  overflow: clip;
  box-shadow:
    0 10px 15px -3px oklch(12% 9% 264deg / 8%),
    0 4px 6px -4px oklch(12% 9% 264deg / 8%);
}

.baseui-store-inspector-header {
  display: flex;
  align-items: center;
  cursor: move;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
  padding: 4px 8px 8px 8px;
  gap: 8px;

  h2 {
    font-size: 16px;
    flex-grow: 1;
  }
}

.baseui-store-inspector-header button {
  all: unset;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.baseui-store-inspector-header button:hover,
.baseui-store-inspector-header button:focus-visible {
  opacity: 0.8;
}

.baseui-store-inspector-resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  right: -4px;
  bottom: -4px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.25) 50%);
  border-radius: 2px;
}
`;

function getTarget(event: Event) {
  if ('composedPath' in event) {
    return event.composedPath()[0];
  }

  return (event as Event).target;
}

export interface StoreInspectorProps {
  /**
   * Instance of the store to inspect.
   */
  store: Store<any>;
  /**
   * Additional data to display in the inspector.
   */
  additionalData?: any;
  /**
   * Title to display in the panel header.
   */
  title?: string | undefined;
  /**
   * Whether the inspector panel should be open by default.
   * @default false
   */
  defaultOpen?: boolean | undefined;
}

/**
 * A tool to inspect the state of a Store in a floating panel.
 * This is intended for development and debugging purposes.
 */
export function StoreInspector(props: StoreInspectorProps) {
  const { store, title, additionalData, defaultOpen = false } = props;
  const [open, setOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <React.Fragment>
      <style href="baseui-store-inspector" precedence="default">
        {STYLES}
      </style>
      <button
        ref={triggerRef}
        className="baseui-store-inspector-trigger"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Toggle store inspector"
        aria-hidden
      >
        <FileJson />
      </button>
      <StoreInspectorPanel
        anchorElement={triggerRef.current}
        open={open}
        store={store}
        title={title}
        additionalData={additionalData}
        onClose={() => setOpen(false)}
      />
    </React.Fragment>
  );
}

interface PanelProps {
  anchorElement: HTMLElement | null;
  store: Store<any>;
  title?: string | undefined;
  additionalData?: any;
  open: boolean;
  onClose?: (() => void) | undefined;
}

export function StoreInspectorPanel({
  anchorElement,
  store,
  title,
  additionalData,
  open,
  onClose,
}: PanelProps) {
  const rerender = useForcedRerendering();
  const rerenderTimeout = useTimeout();

  // Update when state changes
  useIsoLayoutEffect(() => {
    const unsubscribe = store.subscribe(() => {
      rerenderTimeout.start(1, () => rerender());
    });

    return unsubscribe;
  }, [store, rerender, rerenderTimeout]);

  const logToConsole = useStableCallback(() => {
    const data: any = {
      state: store.state,
    };

    if (Object.keys((store as any).context ?? {}).length > 0) {
      data.context = (store as any).context;
    }

    if (additionalData !== undefined) {
      data.additionalData = additionalData;
    }

    // eslint-disable-next-line no-console
    console.log(data);
  });

  if (typeof document === 'undefined') {
    return null;
  }

  const doc = ownerDocument(anchorElement);

  const content = (
    <Window
      title={title ?? 'Store Inspector'}
      onClose={onClose}
      headerActions={
        <button type="button" onClick={logToConsole} title="Log to console">
          <SquareTerminal />
        </button>
      }
    >
      <h3>State</h3>
      <pre>{JSON.stringify(store.state, getStringifyReplacer(), 2)}</pre>
      {Object.keys((store as any).context ?? {}).length > 0 && (
        <React.Fragment>
          <h3>Context</h3>
          <pre>{JSON.stringify((store as any).context, getStringifyReplacer(), 2)}</pre>
        </React.Fragment>
      )}
      {additionalData !== undefined && (
        <React.Fragment>
          <h3>Additional data</h3>
          <pre>{JSON.stringify(additionalData, getStringifyReplacer(), 2)}</pre>
        </React.Fragment>
      )}
    </Window>
  );

  return open ? ReactDOM.createPortal(content, doc.body) : null;
}

function getStringifyReplacer() {
  const ancestors: any[] = [];

  return function replacer(this: unknown, _: string, value: unknown) {
    if (isElement(value)) {
      return `Element(${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''})`;
    }

    if (value === undefined) {
      return '[undefined]';
    }

    if (value instanceof Map) {
      return Array.from(value.entries());
    }

    if (value instanceof Set) {
      return Array.from(value);
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }
    // `this` is the object that value is contained in,
    // i.e., its direct parent.
    while (ancestors.length > 0 && ancestors.at(-1) !== this) {
      ancestors.pop();
    }

    if (ancestors.includes(value)) {
      return '[circular reference]';
    }

    ancestors.push(value);
    return value;
  };
}

interface WindowProps {
  title?: string | undefined;
  onClose?: (() => void) | undefined;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

/**
 * A reusable draggable and resizable window component.
 * Handles all the pointer events for dragging and resizing internally.
 */
function Window({ title, onClose, children, headerActions }: WindowProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const resizeHandleRef = React.useRef<HTMLDivElement | null>(null);
  const raf = useAnimationFrame();
  const minWidth = 160;
  const minHeight = 52;

  // Track position when user drags the window
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
  const dragStateRef = React.useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  // Track size when user resizes the window
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  const resizeStateRef = React.useRef<{
    resizing: boolean;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
  } | null>(null);

  useIsoLayoutEffect(() => {
    if (position != null) {
      return;
    }
    const el = rootRef.current;
    if (!el) {
      return;
    }

    setPosition({ left: 8, top: 8 });
  }, [position]);

  const onPointerDown = useStableCallback((event: React.PointerEvent) => {
    if (!headerRef.current || !rootRef.current) {
      return;
    }
    const target = getTarget(event.nativeEvent) as Element | null;
    if (target && target.closest('button')) {
      return;
    }
    const currentPos = position ?? { left: 8, top: 8 };
    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: currentPos.left,
      startTop: currentPos.top,
    };
    try {
      headerRef.current.setPointerCapture(event.pointerId);
    } catch {
      void 0;
    }
    event.preventDefault();
  });

  const endDrag = useStableCallback((event?: PointerEvent) => {
    if (headerRef.current && event) {
      try {
        headerRef.current.releasePointerCapture(event.pointerId);
      } catch {
        void 0;
      }
    }
    if (dragStateRef.current) {
      dragStateRef.current.dragging = false;
    }
  });

  const onPointerMove = useStableCallback((event: PointerEvent) => {
    const state = dragStateRef.current;
    if (!state || !state.dragging) {
      return;
    }
    const nextLeft = state.startLeft + (event.clientX - state.startX);
    const nextTop = Math.max(0, state.startTop + (event.clientY - state.startY));

    raf.request(() => {
      setPosition({ left: nextLeft, top: nextTop });
    });
  });

  const onResizePointerDown = useStableCallback((event: React.PointerEvent) => {
    if (!rootRef.current) {
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const currentSize = size ?? { width: rect.width, height: rect.height };
    const currentLeft = position?.left ?? rect.left;
    const currentTop = position?.top ?? rect.top;
    const win = ownerWindow(rootRef.current);
    const maxWidth = Math.max(100, win.innerWidth - currentLeft);
    const maxHeight = Math.max(80, win.innerHeight - currentTop);
    resizeStateRef.current = {
      resizing: true,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: currentSize.width,
      startHeight: currentSize.height,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
    };
    try {
      (event.currentTarget as any)?.setPointerCapture?.((event as any).pointerId);
    } catch {
      void 0;
    }
    event.preventDefault();
  });

  const onResizePointerMove = useStableCallback((event: PointerEvent) => {
    const state = resizeStateRef.current;
    if (!state || !state.resizing) {
      return;
    }
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const nextWidth = Math.min(state.maxWidth, Math.max(state.minWidth, state.startWidth + dx));
    const nextHeight = Math.min(state.maxHeight, Math.max(state.minHeight, state.startHeight + dy));
    raf.request(() => {
      setSize({ width: nextWidth, height: nextHeight });
    });
  });

  const endResize = useStableCallback((event?: PointerEvent) => {
    if (event) {
      try {
        (getTarget(event) as any)?.releasePointerCapture?.((event as any).pointerId);
      } catch {
        void 0;
      }
    }
    if (resizeStateRef.current) {
      resizeStateRef.current.resizing = false;
    }
  });

  // Bind/unbind global listeners for dragging and resizing
  useIsoLayoutEffect(() => {
    const win = ownerWindow(rootRef.current);
    const move = (event: PointerEvent) => {
      onPointerMove(event);
      onResizePointerMove(event);
    };
    const up = (event: PointerEvent) => {
      endDrag(event);
      endResize(event);
    };
    return mergeCleanups(
      addEventListener(win, 'pointermove', move),
      addEventListener(win, 'pointerup', up),
      addEventListener(win, 'pointercancel', up),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute window style once per render
  const style: React.CSSProperties = {};
  let win: Window | null = null;
  if (rootRef.current) {
    win = ownerWindow(rootRef.current);
  } else if (typeof window !== 'undefined') {
    win = window;
  }
  const viewportMax = win ? Math.max(0, win.innerHeight - 16) : undefined;
  if (position) {
    style.top = position.top;
    style.left = position.left;
    style.right = 'auto';
    style.position = 'fixed';
    if (size?.width != null) {
      style.width = size.width;
    }
    if (size?.height != null) {
      style.height = size.height;
    }
    style.maxHeight = win ? Math.max(0, win.innerHeight - position.top - 8) : undefined;
  } else {
    if (size?.width != null) {
      style.width = size.width;
    }
    if (size?.height != null) {
      style.height = size.height;
    }
    style.maxHeight = viewportMax;
  }

  return (
    <div ref={rootRef} className="baseui-store-inspector-root" style={style}>
      <div ref={headerRef} className="baseui-store-inspector-header" onPointerDown={onPointerDown}>
        <h2>{title}</h2>
        {headerActions}
        <button type="button" onClick={onClose} title="Close window">
          <CloseIcon />
        </button>
      </div>
      <div className="baseui-store-inspector-content">{children}</div>
      <div
        ref={resizeHandleRef}
        onPointerDown={onResizePointerDown}
        style={{ position: 'relative' }}
      >
        <div className="baseui-store-inspector-resize-handle" />
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function FileJson() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
      <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
    </svg>
  );
}

function SquareTerminal() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 11 2-2-2-2" />
      <path d="M11 13h4" />
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    </svg>
  );
}
