import SelfWorker from './self-reference-worker?worker';

self.addEventListener('message', ({ data }) => {
  if (data === 'main') {
    const nestedWorker = new SelfWorker();

    nestedWorker.addEventListener('message', (event) => {
      self.postMessage(event.data);
      nestedWorker.terminate();
    });
    nestedWorker.postMessage('nested');
  }

  self.postMessage(`pong: ${data}`);
});
