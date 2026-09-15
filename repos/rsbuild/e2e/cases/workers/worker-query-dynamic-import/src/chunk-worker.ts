self.onmessage = async () => {
  const [{ message }, { default: defaultMessage }] = await Promise.all([
    import('./module-a'),
    import('./module-b'),
  ]);

  self.postMessage({
    text: `${message}:${defaultMessage}`,
  });
};
