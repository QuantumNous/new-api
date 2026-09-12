import InlineModuleWorker from './inline-module-worker?worker&inline';
import ModuleWorker from './module-worker?worker';

document.body.innerHTML = `
  <div id="worker"></div>
  <div id="inline"></div>
`;

const setText = (selector: string, text: string) => {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
};

const moduleWorker = new ModuleWorker({ name: 'worker' });

moduleWorker.addEventListener('message', ({ data }) => {
  setText('#worker', data.text);
  moduleWorker.terminate();
});
moduleWorker.postMessage('msg');

const inlineModuleWorker = new InlineModuleWorker({
  name: 'inline',
});

inlineModuleWorker.addEventListener('message', ({ data }) => {
  setText('#inline', data.text);
  inlineModuleWorker.terminate();
});
inlineModuleWorker.postMessage('msg');
