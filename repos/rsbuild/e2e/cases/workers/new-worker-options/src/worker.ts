self.onmessage = () => {
  self.postMessage({
    name: self.name,
  });
};
