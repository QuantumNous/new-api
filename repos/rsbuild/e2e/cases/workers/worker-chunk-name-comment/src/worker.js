self.onmessage = ({ data: { question } }) => {
  self.postMessage({
    answer: `${question}: 42`,
  });
};
