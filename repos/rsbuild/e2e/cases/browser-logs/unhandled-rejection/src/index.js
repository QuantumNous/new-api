Promise.reject(404);
Promise.reject(false);
Promise.reject(null);
Promise.reject(undefined);
Promise.reject('string');
Promise.reject({ name: 'Custom', message: 'custom message' });
Promise.reject(new Error('reason'));
Promise.reject(new DOMException('Aborted', 'AbortError'));

(async () => {
  throw new Error('Thrown in async');
})();

const ctrl = new AbortController();
fetch('data:text/plain,hi', { signal: ctrl.signal });
ctrl.abort();
