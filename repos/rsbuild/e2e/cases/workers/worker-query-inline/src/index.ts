import InlineWorker from './inline-worker?worker&inline';
import InlineWorkerReordered from './inline-worker?inline&worker';

document.body.innerHTML = `
  <div id="worker"></div>
  <div id="reordered"></div>
  <div id="unicode"></div>
`;

const setText = (selector: string, text: string) => {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
};

const runWorker = (
  worker: Worker,
  message: unknown,
  selector: string,
  format: (data: Record<string, string>) => string,
) => {
  worker.addEventListener('message', ({ data }) => {
    setText(selector, format(data));
    worker.terminate();
  });
  worker.postMessage(message);
};

runWorker(
  new InlineWorker({ name: 'named' }),
  'named',
  '#worker',
  (data) => `${data.text} ${data.name} ${data.marker}`,
);

runWorker(new InlineWorkerReordered(), 'reordered', '#reordered', (data) => data.text);

runWorker(new InlineWorker(), 'unicode', '#unicode', (data) => data.text);
