import InlineWorker from './worker?worker&inline';

document.body.innerHTML = '<div id="result"></div>';

const worker = new InlineWorker();

worker.addEventListener('message', ({ data }) => {
  const element = document.querySelector('#result');
  if (element) {
    element.textContent = `${data.text} ${data.marker}`;
  }
  worker.terminate();
});

worker.postMessage('inline');
