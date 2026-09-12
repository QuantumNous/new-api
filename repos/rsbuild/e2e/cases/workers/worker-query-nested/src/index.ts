import NestedWorker from './nested-worker?worker';

document.body.innerHTML = `
  <div id="worker"></div>
  <div id="sub"></div>
  <div id="ctor"></div>
`;

const setText = (selector: string, text: string) => {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
};

const worker = new NestedWorker();

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'main') {
    setText('#worker', `${data.text} ${data.href}`);
  } else if (data.type === 'sub') {
    setText('#sub', data.text);
  } else if (data.type === 'ctor') {
    setText('#ctor', data.text);
  }
});

worker.postMessage('ping');
