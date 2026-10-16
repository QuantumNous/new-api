const marker = 'inline-dynamic-marker';

self.onmessage = async ({ data }) => {
  const { getMessage } = await import('./message');

  self.postMessage({
    marker,
    text: getMessage(data),
  });
};
