console.debug('test-console-debug');
console.log('test-console-log');
console.warn('test-console-warn');
console.error('test-console-error');

let sideEffectValue = '';
console.log('test-console-side-effect', (sideEffectValue = 'side-effect-preserved'));
globalThis.__REMOVE_CONSOLE_SIDE_EFFECT__ = sideEffectValue;
