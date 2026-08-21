window.addEventListener('trigger-runtime-error', (event) => {
  setTimeout(() => {
    const error = new Error(event.detail.message);
    error.name = event.detail.name;
    throw error;
  });
});
