import SelfReferenceWorker from './self-reference-worker?worker';

document.body.innerHTML = '<div id="worker"></div>';

const worker = new SelfReferenceWorker();

worker.addEventListener('message', ({ data }) => {
  const element = document.querySelector('#worker');
  if (element) {
    element.textContent += `${data}\n`;
  }
});

worker.postMessage('main');
