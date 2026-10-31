const worker = new Worker(
  /* rspackChunkName: "foo-worker" */ new URL('./worker.js', import.meta.url),
);

worker.postMessage({
  question: 'The Answer to the Ultimate Question of Life, The Universe, and Everything',
});

worker.onmessage = ({ data: { answer } }) => {
  document.getElementById('root').innerHTML = answer;
};
