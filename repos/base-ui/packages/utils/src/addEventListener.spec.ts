import { expectType } from './testUtils';
import { addEventListener } from './addEventListener';

const unsubscribeFromWindowPointerMove = addEventListener(window, 'pointermove', (event) => {
  expectType<PointerEvent, typeof event>(event);
});
expectType<() => void, typeof unsubscribeFromWindowPointerMove>(unsubscribeFromWindowPointerMove);

const element = document.createElement('div');
const unsubscribeFromElementKeyDown = addEventListener(element, 'keydown', (event) => {
  expectType<KeyboardEvent, typeof event>(event);
});
expectType<() => void, typeof unsubscribeFromElementKeyDown>(unsubscribeFromElementKeyDown);

const genericElement: Element = document.createElement('div');
const unsubscribeFromGenericElement = addEventListener(genericElement, 'keydown', (event) => {
  expectType<KeyboardEvent, typeof event>(event);
});
expectType<() => void, typeof unsubscribeFromGenericElement>(unsubscribeFromGenericElement);

const mediaQueryList = window.matchMedia('(min-width: 1px)');
const unsubscribeFromMediaQuery = addEventListener(mediaQueryList, 'change', (event) => {
  expectType<MediaQueryListEvent, typeof event>(event);
});
expectType<() => void, typeof unsubscribeFromMediaQuery>(unsubscribeFromMediaQuery);

const genericTarget = new EventTarget();
const unsubscribeFromGenericTarget = addEventListener(genericTarget, 'custom', (_event) => {});
expectType<() => void, typeof unsubscribeFromGenericTarget>(unsubscribeFromGenericTarget);

function handleKeyboardEvent(event: KeyboardEvent) {
  expectType<KeyboardEvent, typeof event>(event);
}

// @ts-expect-error pointermove expects a pointer event handler
addEventListener(window, 'pointermove', handleKeyboardEvent);

// @ts-expect-error keydown expects a keyboard event handler
addEventListener(element, 'keydown', (event: PointerEvent) => {
  expectType<PointerEvent, typeof event>(event);
});
