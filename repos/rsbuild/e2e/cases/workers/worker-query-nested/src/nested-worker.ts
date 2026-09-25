import SubWorker from './sub-worker?worker';

const subWorker = new SubWorker({ name: 'sub' });
const constructorWorker = new Worker(new URL('./url-worker.ts', import.meta.url), {
  name: 'ctor',
  type: 'module',
});

self.postMessage({
  href: self.location.href,
  text: 'main',
  type: 'main',
});

self.onmessage = ({ data }) => {
  if (data === 'ping') {
    subWorker.postMessage('ping');
  }
};

subWorker.addEventListener('message', ({ data }) => {
  self.postMessage(data);
});

constructorWorker.addEventListener('message', ({ data }) => {
  self.postMessage(data);
});
