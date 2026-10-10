type EventTargetWithListeners = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type KnownEventTarget =
  | AbortSignal
  | Document
  | Element
  | HTMLElement
  | MediaQueryList
  | SVGElement
  | VisualViewport
  | Window;

type EventMap<Target> = Target extends Window
  ? WindowEventMap
  : Target extends Document
    ? DocumentEventMap
    : Target extends MediaQueryList
      ? MediaQueryListEventMap
      : Target extends VisualViewport
        ? VisualViewportEventMap
        : Target extends SVGElement
          ? SVGElementEventMap
          : Target extends HTMLElement
            ? HTMLElementEventMap
            : Target extends Element
              ? ElementEventMap & GlobalEventHandlersEventMap
              : Target extends AbortSignal
                ? AbortSignalEventMap
                : never;

type TypedEventListener<Target, Event> =
  | { handleEvent(event: Event): void }
  | ((this: Target, event: Event) => void);

/**
 * Adds an event listener and returns a cleanup function to remove it.
 */
export function addEventListener<
  Target extends KnownEventTarget,
  Type extends keyof EventMap<Target>,
>(
  target: Target,
  type: Type,
  listener: TypedEventListener<Target, EventMap<Target>[Type]>,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function addEventListener(
  target: EventTargetWithListeners,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function addEventListener(
  target: EventTargetWithListeners,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) {
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}
