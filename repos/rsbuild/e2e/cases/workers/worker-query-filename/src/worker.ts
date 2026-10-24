self.onmessage = ({ data }) => {
  self.postMessage(`${data}: worker-filename-marker`);
};
