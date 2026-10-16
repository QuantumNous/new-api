const worker = new Worker(new URL('./worker.ts', import.meta.url));

worker.postMessage({
  question: 'The Answer to the Ultimate Question of Life, The Universe, and Everything',
});

worker.onmessage = ({ data: { answer } }) => {
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = answer;
  }
};
