document.body.innerHTML = '<div id="root"></div>';

let credentials = '';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  get credentials(): RequestCredentials {
    credentials = 'include';
    return 'include';
  },
  name: 'worker',
  type: 'module',
});

worker.addEventListener('message', ({ data }) => {
  const element = document.getElementById('root');
  if (element) {
    element.textContent = [data.name, credentials].join(':');
  }
  worker.terminate();
});

worker.postMessage('ping');
