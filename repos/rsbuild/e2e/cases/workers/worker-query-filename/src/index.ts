import QueryWorker from './worker?worker';

const worker = new QueryWorker();

worker.addEventListener('message', ({ data }) => {
  document.body.textContent = data;
  worker.terminate();
});

worker.postMessage('filename');
