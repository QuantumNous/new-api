import ChunkWorker from './chunk-worker?worker';

document.body.innerHTML = '<div id="worker"></div>';

const worker = new ChunkWorker();

worker.addEventListener('message', ({ data }) => {
  const element = document.querySelector('#worker');
  if (element) {
    element.textContent = data.text;
  }
  worker.terminate();
});

worker.postMessage('ping');
