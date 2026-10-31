self.onmessage = ({ data }) => {
  if (data === 'ping') {
    self.postMessage({
      text: `sub:${self.name || 'anonymous'}`,
      type: 'sub',
    });
  }
};
