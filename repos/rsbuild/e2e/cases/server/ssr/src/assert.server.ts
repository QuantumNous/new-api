export function assert() {
  if (typeof queueMicrotask !== 'function') {
    throw Error('not support queueMicrotask in this environment');
  }
  if (typeof TextEncoder !== 'function') {
    throw Error('not support TextEncoder in this environment');
  }
}
