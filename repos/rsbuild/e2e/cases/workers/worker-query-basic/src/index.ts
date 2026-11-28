import MjsWorker from './mjs-worker.mjs?worker';
import QueryWorker from './query-worker?worker';

document.body.innerHTML = `
  <div id="worker"></div>
  <div id="mjs"></div>
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

runWorker(new QueryWorker({ name: 'named' }), 'ping', '#worker', (data) => data.text);

runWorker(new MjsWorker(), 'mjs', '#mjs', (data) => data.text);
