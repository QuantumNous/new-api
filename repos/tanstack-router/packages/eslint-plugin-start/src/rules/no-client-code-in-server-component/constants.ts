import globals from 'globals'

/**
 * Hooks allowed in server components
 */
export const DEFAULT_ALLOWED_HOOKS = new Set(['useId'])

/**
 * React hooks to detect (common ones that are NOT allowed in server components)
 */
export const REACT_HOOKS = new Set([
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useReducer',
  'useCallback',
  'useMemo',
  'useRef',
  'useContext',
  'useImperativeHandle',
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useSyncExternalStore',
  'useInsertionEffect',
  'useOptimistic',
  'useFormStatus',
  'useActionState',
])

/**
 * Browser-only globals not available in server context
 * Dynamically computed from globals package: browser globals that are NOT in node
 */
export const BROWSER_ONLY_GLOBALS: Set<string> = (() => {
  const browserGlobals = Object.keys(globals.browser as Record<string, boolean>)
  const nodeGlobals = new Set(
    Object.keys(globals.node as Record<string, boolean>),
  )

  const browserOnly = new Set<string>()
  for (const name of browserGlobals) {
    if (!nodeGlobals.has(name)) {
      browserOnly.add(name)
    }
  }
  return browserOnly
})()

/**
 * React event handler props - comprehensive list from React types
 */
export const REACT_EVENT_HANDLERS = new Set([
  // Clipboard Events
  'onCopy',
  'onCopyCapture',
  'onCut',
  'onCutCapture',
  'onPaste',
  'onPasteCapture',

  // Composition Events
  'onCompositionEnd',
  'onCompositionEndCapture',
  'onCompositionStart',
  'onCompositionStartCapture',
  'onCompositionUpdate',
  'onCompositionUpdateCapture',

  // Focus Events
  'onFocus',
  'onFocusCapture',
  'onBlur',
  'onBlurCapture',

  // Form Events
  'onChange',
  'onChangeCapture',
  'onBeforeInput',
  'onBeforeInputCapture',
  'onInput',
  'onInputCapture',
  'onReset',
  'onResetCapture',
  'onSubmit',
  'onSubmitCapture',
  'onInvalid',
  'onInvalidCapture',

  // Image Events
  'onLoad',
  'onLoadCapture',
  'onError',
  'onErrorCapture',

  // Keyboard Events
  'onKeyDown',
  'onKeyDownCapture',
  'onKeyPress',
  'onKeyPressCapture',
  'onKeyUp',
  'onKeyUpCapture',

  // Media Events
  'onAbort',
  'onAbortCapture',
  'onCanPlay',
  'onCanPlayCapture',
  'onCanPlayThrough',
  'onCanPlayThroughCapture',
  'onDurationChange',
  'onDurationChangeCapture',
  'onEmptied',
  'onEmptiedCapture',
  'onEncrypted',
  'onEncryptedCapture',
  'onEnded',
  'onEndedCapture',
  'onLoadedData',
  'onLoadedDataCapture',
  'onLoadedMetadata',
  'onLoadedMetadataCapture',
  'onLoadStart',
  'onLoadStartCapture',
  'onPause',
  'onPauseCapture',
  'onPlay',
  'onPlayCapture',
  'onPlaying',
  'onPlayingCapture',
  'onProgress',
  'onProgressCapture',
  'onRateChange',
  'onRateChangeCapture',
  'onResize',
  'onResizeCapture',
  'onSeeked',
  'onSeekedCapture',
  'onSeeking',
  'onSeekingCapture',
  'onStalled',
  'onStalledCapture',
  'onSuspend',
  'onSuspendCapture',
  'onTimeUpdate',
  'onTimeUpdateCapture',
  'onVolumeChange',
  'onVolumeChangeCapture',
  'onWaiting',
  'onWaitingCapture',

  // Mouse Events
  'onAuxClick',
  'onAuxClickCapture',
  'onClick',
  'onClickCapture',
  'onContextMenu',
  'onContextMenuCapture',
  'onDoubleClick',
  'onDoubleClickCapture',
  'onDrag',
  'onDragCapture',
  'onDragEnd',
  'onDragEndCapture',
  'onDragEnter',
  'onDragEnterCapture',
  'onDragExit',
  'onDragExitCapture',
  'onDragLeave',
  'onDragLeaveCapture',
  'onDragOver',
  'onDragOverCapture',
  'onDragStart',
  'onDragStartCapture',
  'onDrop',
  'onDropCapture',
  'onMouseDown',
  'onMouseDownCapture',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseMove',
  'onMouseMoveCapture',
  'onMouseOut',
  'onMouseOutCapture',
  'onMouseOver',
  'onMouseOverCapture',
  'onMouseUp',
  'onMouseUpCapture',

  // Selection Events
  'onSelect',
  'onSelectCapture',

  // Touch Events
  'onTouchCancel',
  'onTouchCancelCapture',
  'onTouchEnd',
  'onTouchEndCapture',
  'onTouchMove',
  'onTouchMoveCapture',
  'onTouchStart',
  'onTouchStartCapture',

  // Pointer Events
  'onPointerDown',
  'onPointerDownCapture',
  'onPointerMove',
  'onPointerMoveCapture',
  'onPointerUp',
  'onPointerUpCapture',
  'onPointerCancel',
  'onPointerCancelCapture',
  'onPointerEnter',
  'onPointerEnterCapture',
  'onPointerLeave',
  'onPointerLeaveCapture',
  'onPointerOver',
  'onPointerOverCapture',
  'onPointerOut',
  'onPointerOutCapture',
  'onGotPointerCapture',
  'onGotPointerCaptureCapture',
  'onLostPointerCapture',
  'onLostPointerCaptureCapture',

  // UI Events
  'onScroll',
  'onScrollCapture',

  // Wheel Events
  'onWheel',
  'onWheelCapture',

  // Animation Events
  'onAnimationStart',
  'onAnimationStartCapture',
  'onAnimationEnd',
  'onAnimationEndCapture',
  'onAnimationIteration',
  'onAnimationIterationCapture',

  // Transition Events
  'onTransitionEnd',
  'onTransitionEndCapture',
])

/**
 * Check if a prop name is a React event handler
 */
export function isReactEventHandler(name: string): boolean {
  return REACT_EVENT_HANDLERS.has(name)
}

/**
 * Check if a hook name is client-only (not allowed in server components)
 */
export function isClientOnlyHook(
  name: string,
  allowedHooks: Set<string> = DEFAULT_ALLOWED_HOOKS,
): boolean {
  // Must match use[A-Z] pattern
  if (!/^use[A-Z]/.test(name)) return false
  // Check if explicitly allowed
  if (allowedHooks.has(name)) return false
  return true
}
