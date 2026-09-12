import { platform } from '@base-ui/utils/platform';

export function stopEvent(event: Event | React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function isReactEvent(event: any): event is React.SyntheticEvent {
  return 'nativeEvent' in event;
}

// License: https://github.com/adobe/react-spectrum/blob/main/packages/@react-aria/utils/src/isVirtualEvent.ts
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
  if ((event as PointerEvent).pointerType === '' && event.isTrusted) {
    return true;
  }

  if (platform.os.android && (event as PointerEvent).pointerType) {
    return event.type === 'click' && event.buttons === 1;
  }

  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

export function isVirtualPointerEvent(event: PointerEvent) {
  if (platform.env.jsdom) {
    return false;
  }
  return (
    (!platform.os.android && event.width === 0 && event.height === 0) ||
    (platform.os.android &&
      event.width === 1 &&
      event.height === 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === 'mouse') ||
    // iOS VoiceOver returns 0.333• for width/height.
    (event.width < 1 &&
      event.height < 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === 'touch')
  );
}

export function isMouseLikePointerType(pointerType: string | undefined, strict?: boolean) {
  // On some Linux machines with Chromium, mouse inputs return a `pointerType`
  // of "pen": https://github.com/floating-ui/floating-ui/issues/2015
  const values: Array<string | undefined> = ['mouse', 'pen'];
  if (!strict) {
    values.push('', undefined);
  }
  return values.includes(pointerType);
}

export function isClickLikeEvent(event: Event | React.SyntheticEvent) {
  const type = event.type;
  return type === 'click' || type === 'mousedown' || type === 'keydown' || type === 'keyup';
}
